# IAM change email

`feat/iam-change-email` adds verified email changes for active, email-verified
Explorer and Merchant accounts. It builds on the preceding IAM password,
session-policy, and deactivation branches. It reuses the established mobile
components, `bg-surface`, transactional email service, response envelopes, and
local session cleanup. Admin provisioning and Web Admin email editing are
outside this mobile self-service flow.

## User flow

1. Profile → Account Settings → Change email shows the current sign-in address
   and any pending destination returned by the server.
2. Enter a different available email and the current password, then send
   verification. Password text is preserved exactly; email input is trimmed
   and canonicalized case-insensitively.
3. The current email, verified state, password, account ownership, and sessions
   remain unchanged while verification is pending.
4. Open the link from the new inbox in the installed SugboGo app. Enter the
   current password again and explicitly choose Confirm email change. Opening
   the link alone never consumes it.
5. Confirmation updates the verified sign-in address and revokes existing
   sessions. Sign in again with the new email and unchanged plaintext password.
   Email sign-in now matches case-insensitively, consistent with uniqueness.
6. The previous inbox receives a best-effort security notice after commit.

Passwordless accounts first use the existing password setup/email recovery
flow, sign in again, then return to Change email. Linked provider identities
remain linked to the same user ID; Google/Facebook sign-in does not overwrite
the newly verified address for an already-linked provider. Business contact
details, merchant applications, listings, reviews, and vouches are unchanged.

## API

All responses use the existing success/error envelope.

| Endpoint | Authorization | Payload / result |
| --- | --- | --- |
| `POST /api/auth/change-email/` | Access JWT | `new_email`, `current_password`; returns pending `new_email`, `expires_at` |
| `GET /api/auth/change-email/status/` | Access JWT | Returns `current_email`, `pending` object or null |
| `POST /api/auth/change-email/cancel/` | Access JWT | Cancels the current account's pending request; no identity change |
| `POST /api/auth/change-email/confirm/` | Emailed secret and password | `request_id` UUID, `token`, `current_password`; returns `user_id`, `email` |

Confirmation deliberately ignores bearer credentials, so expired tokens or an
unrelated local login cannot prevent verification. Both the email secret and
current password are required; neither alone authorizes an email change.
There is no GET endpoint that mutates email state.

Only one pending request is stored per account. Resending requires password
proof and replaces the secret, including when the destination stays the same.
The latest link expires after `EMAIL_CHANGE_TIMEOUT_SECONDS` (30 minutes).
Cancellation, replacement, expiration, password changes, or an identity change
make older proofs unusable. Inactive or unverified accounts cannot confirm or
reactivate themselves through this flow. A pending address is not reserved;
availability is checked again at confirmation.

Request delivery/password attempts are limited to five per hour per user.
Confirmation is limited to five attempts per minute per request identifier,
plus the existing anonymous IP baseline. Status and cancellation remain
available when the delivery limit is reached. Limits use the configured DRF
cache; no persistent account-lockout behavior is introduced here.

## Integrity and failure handling

The database stores a SHA-256 hash of a cryptographically random verification
secret, a keyed snapshot of credential/identity state, destination, and expiry.
It stores no plaintext password or raw verification token. Status responses
expose only the destination and deadline. Email links contain no password.

Account row locks serialize request replacement, cancellation, confirmation,
and session rotation. Confirmation rechecks eligibility, credential state,
secret, expiry, password, and address availability under those locks. The
address update, same-password rehash, refresh revocations, and proof consumption
are atomic. Rehashing invalidates old access JWTs through the existing
`CHECK_REVOKE_TOKEN` policy. Existing email-bound reset/verification links also
stop working. Concurrent unique-address conflicts return a validation error.

Verification delivery failure returns 503 and rolls back the replacement, so
an earlier pending link remains usable. Delivery is an external side effect:
an email already accepted by the provider cannot be recalled if the database
later fails. Such a link will fail validation rather than change the account.
The old-inbox notice is best effort after commit; delivery failure is logged
without reverting the confirmed email. There is no durable delivery outbox.

The mobile query preserves the current/pending distinction, survives reopening,
and exposes retryable loading/error states. Mutations do not retry automatically.
Cancelled in-flight status queries cannot overwrite successful request updates.
Session-generation guards prevent old request responses from updating a newer
login's cache. Confirmation clears local authentication only when the originating
local account matches the confirmed user and its session is still current.
An unrelated or newer local login is retained; exit navigation checks current
state instead of forcing that account to sign out.

If confirmation commits but the response is lost, retrying the consumed link
will fail. The account's new address remains authoritative; use the new address
to sign in. Other devices lose protected access on their next request; the
feature does not remotely erase offline device files or cancel requests that
were already authorized. Existing notification sockets check account status
and expiry; this branch adds no instant socket-disconnect mechanism.

## Migrations and rollout

- `users.0016_email_change` adds a case-insensitive unique constraint over
  `USER_EMAIL`. A preflight check stops if existing accounts differ only by
  capitalization. Resolve ownership manually before retrying; the migration
  never merges or deletes accounts.
- `authentication.0004_email_change` creates `EMAIL_CHANGE_REQUEST` and depends
  on the uniqueness migration.
- No new packages or native mobile build changes are required. The installed
  development client must load this branch's Metro code to resolve the new
  `com.sugbogo.app://confirm-email-change` route. Links use `MOBILE_SCHEME`.

Before using this feature in the application database, run from the backend:

```powershell
..\.venv\Scripts\python.exe manage.py migrate
```

This implementation has not applied migrations to the application database or
run demo seeds. Automated tests apply schema changes only to the test database.
The uniqueness constraint affects every account-creation path; tests include
direct case-variant inserts and existing authentication/admin regressions.

## Verification

From `sugbogo_backend`:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.authentication apps.users.views.tests.test_profile_views apps.admin_operations.user_management --keepdb --noinput
..\.venv\Scripts\python.exe manage.py makemigrations authentication users --check --dry-run
```

From `sugbogo_frontend/mobile`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/features/auth/hooks/__tests__/useEmailChange.test.tsx src/features/profile/screens/__tests__/ChangeEmailScreen.test.tsx src/features/profile/screens/__tests__/ChangePasswordScreen.test.tsx src/features/profile/screens/__tests__/DeactivateAccountScreen.test.tsx src/features/auth/hooks/__tests__/useChangePassword.test.tsx src/features/auth/hooks/__tests__/useDeactivateAccount.test.tsx
```

Manual QA should use disposable Explorer and Merchant accounts: request and
cancel a link, replace it, verify old links fail, confirm while signed out,
verify old sessions fail, and sign in with the new address. Check email app
deep-link handling, keyboard and large-text layouts, and delivery to both
inboxes. Confirming another account's link must not clear the local account.
Live delivery/provider, emulator, and true concurrent multi-client QA remain
separate from mocked automated checks.

### Recorded results

- Full backend regression run: 280 authentication, profile-view, and admin
  user-management tests passed; no Django system-check issues.
- Final case-insensitive sign-in adjustment: 52 email-change, mobile-login,
  and admin-login tests passed in a focused follow-up run (overlapping coverage).
- Mobile: 42 tests across six email-change, password, and deactivation suites
  passed.
- ESLint passed for changed mobile files. Prettier formatted the new mobile
  source/tests; `git diff --check` passed.
- The final migration check reported no changes in `authentication` or `users`.
- Mobile `tsc --noEmit` still reports the same 24 pre-existing errors in
  untouched files; none are in this branch's changed files.
- Application migrations, seed execution, live email delivery, and emulator QA
  were not performed.
