# IAM core-flow verification

Reviewed **20 October 2026 (Asia/Manila)** on
`test/iam-core-flow-verification`, based on `feat/iam-account-lockout` (`aabaa138`).
The target is the combined IAM branch stack, not an assertion about deployed
`main` or unmerged PRs. My Pockets, Merchant registration, development seed data,
and the wider audit-fix backlog are outside this work.

## Result and fixes

Core API journeys and the existing mobile/admin automated checks pass. Release
acceptance still requires the manual and environment checks below. No frontend
design changes or new database migrations were introduced in this branch.

The connected checks reproduced and corrected two inconsistencies:

- Registration and password reset trimmed password text, while login and
  password change preserved it. These setting fields now preserve the exact
  submitted value, and reset confirmation requires an exact match. A shared
  Django password validator rejects whitespace-only passwords, which the login
  forms cannot submit, without stripping spaces around a usable password.
- Verification resend used a case-sensitive email lookup after case-insensitive
  login had already identified an unverified account. Resend now resolves the
  same account across capitalization variants.

No existing password hashes were rewritten. A password stored before this fix
continues to use its existing value; verified recovery remains available if a
user does not know that value.

## Coverage matrix

| Area | Automated evidence | Remaining live acceptance |
| --- | --- | --- |
| Registration and verification | Public registration cannot grant Admin; unverified login is denied; verification enables sign-in; resend resolves the same email identity. | External inbox delivery, resend, and device link handling. |
| Password change/reset | Explorer/Merchant password changes and verified recovery reject old access/refresh sessions; exact password text and confirmation are preserved; blank-only passwords fail without changing credentials. | Keyboard/password-manager behavior and reset email links in the installed app/browser. |
| Email change | Pending/cancelled/replaced state, verified confirmation, unchanged role, old-session revocation, and invalidation after password recovery/deactivation. Account lock remains attached to the user after email changes. | Both inboxes, deep links, signed-out confirmation, and unrelated local-account preservation on a real device. |
| Deactivation/reactivation | Explorer and Merchant cannot sign back in while disabled; only an authorized administrator restores access; old deactivation-era tokens remain invalid after restoration. Existing feature tests also cover retained business ownership. | Lead review of the documented retention/recovery rules; manual admin and mobile flow. |
| Session lifecycle | Both remember-me choices preserve their original refresh deadline; rotated refresh reuse fails; sensitive changes revoke old sessions; logout preserves other sessions and follows the documented short-lived access-token policy. | Device restart, offline recovery, expiry, and switching between accounts. |
| Login history | Account-owned pagination, successful/failed outcomes, correct last_login, sanitized metadata, retention boundary, and idempotent cleanup. | Real-device labels/network address behavior and a running worker/Beat cleanup job. |
| Lockout | Shared account state across portals/IPs/case, fixed observation window/deadline, available verified recovery/OAuth, surviving existing sessions, and real PostgreSQL concurrency checks. | Disposable account attempts, background/resume countdowns, admin form feedback, and recovery delivery. |
| Authorization | Actual admin suspension/reactivation endpoints, immediate live-role enforcement after downgrade, blocked client role escalation, and authentication on account-settings endpoints. | Explorer/Merchant/Admin/Super Admin navigation and protected-screen checks. |
| OAuth/admin invitation | Existing provider verification/error and invitation/session regression suites pass with external providers mocked. | Actual Google/Facebook configuration and sign-in, plus invitation delivery/setup. |

Connected API coverage lives in
`apps/authentication/tests/test_core_flows.py`; individual feature suites retain
their lower-level expiry, concurrency, ownership, failure, and validation checks.
Cross-feature helpers clear the request cache to isolate journeys from IP and
delivery throttles, which are tested separately. They do not bypass account
lockout, proof validation, JWT authentication, or permission checks.

## Explicit session-policy limits

- Ordinary logout revokes the submitted refresh session and clears client state.
  A copied access JWT remains usable until its short expiry. This is an agreed
  existing policy, not immediate server-side access-token revocation.
- Administrative suspension immediately blocks protected access while inactive
  and revokes refresh sessions. Reactivation does not restore those refresh
  sessions. Since suspension does not change the password binding, a previously
  issued unexpired access JWT can become usable again after reactivation.
- Self-deactivation differs: it also rehashes password state, so prior access
  JWTs remain invalid even after manual restoration. Password changes, resets,
  and confirmed email changes also invalidate previously issued credentials.
- Authorization evaluates the current database role. Downgrading an account
  removes protected administrative access even when its access JWT is unexpired.

## Migrations and rollout

A read-only `showmigrations authentication users` check confirmed that this
local application database had **all authentication/user migrations applied**,
including `users.0016_email_change`, `authentication.0004_email_change`,
`authentication.0005_loginevent`, and
`users.0017_user_user_login_failure_count_and_more`.
This branch did not apply migrations or run seeds against that database.

Each other environment must apply its own pending migrations before serving the
combined IAM version. From the repository root:

```powershell
cd sugbogo_backend
& "..\.venv\Scripts\python.exe" manage.py migrate
```

Restart the backend and load the matching mobile/admin frontend code afterward.
Use the normal migration command; do not edit migration history or fake these
migrations. The consistency check reports no new authentication/users model
changes in this branch. Tests use an existing PostgreSQL test database; a fresh
deployment from an empty application database was not exercised here.

## Manual acceptance checklist

Use disposable accounts and record the tester, environment, date, and result.
These items remain **pending**, not implicitly passed by automated tests:

- Register, receive and resend verification, open the link, and sign in.
- Check remembered and non-remembered sessions across restart and token expiry.
- Change/reset a password and confirm old devices lose protected access.
- Request/cancel/replace/confirm an email change; check both inboxes, expired
  links, signed-out confirmation, and an unrelated local sign-in.
- Trigger a password lock, confirm the deadline does not extend, switch entered
  identities, resume the backgrounded app, and use recovery/OAuth.
- Deactivate Explorer and Merchant accounts, restore them through authorized
  admin review, and confirm old deactivation-era sessions stay invalid.
- Check login history ownership, pagination, refresh/error recovery, and a
  worker/Beat run of the 90-day cleanup task.
- Check actual Google/Facebook sign-in and admin invitation setup.
- Confirm the production sender/domain, external delivery, trusted proxy chain,
  forwarded-header handling, and shared throttle-cache configuration. Local
  source/settings or mocked delivery do not establish production readiness.
- Obtain the lead's scope decision for Apple login, privileged MFA, editable
  roles, device/session management, and account erasure if any are required by
  the accepted product specification. These are not silently included here.

## Reproducing the automated checks

From `sugbogo_backend`:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.authentication.tests.test_core_flows --keepdb --noinput
..\.venv\Scripts\python.exe manage.py test apps.authentication apps.users.views.tests.test_profile_views apps.admin_operations.user_management --keepdb --noinput
..\.venv\Scripts\python.exe manage.py makemigrations authentication users --check --dry-run
```

Mobile verification runs every authentication suite, the five account-settings
screen/hook suites, and session-networking/storage suites, excluding the
unrelated Google Places coordinate helper. Run `tsc --noEmit` as well.
Admin web checks use Node's test runner with `--test-concurrency=1` for
`authSession.test.js`, `adminInvitationSetup.test.js`, and
`UserAccountActions.test.js`, avoiding competing Vite test-server ports.

### Recorded results

- Backend: **314 regression tests passed** with fast hashing confined to that
  process; application password-hasher configuration was unchanged.
- Mobile: **129 tests passed across 22 suites**, with normal process exit.
- Admin web: **22 tests passed**, run serially.
- Mobile TypeScript: zero errors. Authentication/users migration consistency
  check: no changes detected. No production mobile/web source was modified.
- All **11 connected API journeys passed separately with normal application
  password hashing**. Final Git whitespace checks passed.
- Readiness: automated core verification passed; emulator/browser interaction,
  actual email/OAuth/invitation delivery, deployed scheduler/proxy/cache checks,
  and lead acceptance of session-policy limits/optional scope remain pending.
