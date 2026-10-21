# IAM account deactivation

This branch adds self-service deactivation for Explorer and Merchant accounts.
It builds on `feat/iam-change-password` and `fix/iam-session-policy`, including
the local `bg-surface` correction. Merge those prerequisites first or review
this as a stacked branch.

## API contract

`POST /api/auth/deactivate-account/` requires a valid access JWT and:

```json
{
  "current_password": "the exact current password, including whitespace",
  "confirm_deactivation": true
}
```

The server always targets `request.user`; a supplied user ID cannot target
another account. Both fields are required. A false confirmation, unusable
password, or incorrect password returns the existing validation envelope.
Inactive users cannot authenticate; the service also checks active, verified
state under its account lock. Admin and Super Admin accounts cannot self-deactivate.

A successful response uses the normal success envelope with message
`Account deactivated. Contact support to request reactivation.`
No new credentials are issued.

## State and session policy

- Set the existing `USER_STATUS` to `disabled`; retain role, email, verification,
  and account records. No new model, migration, or dependency is required.
- Rehash the supplied current password without changing its plaintext value.
  The existing `CHECK_REVOKE_TOKEN=True` policy consequently invalidates old
  access JWTs, including after rapid manual reactivation.
- Blacklist every registered refresh token within the same transaction.
  Failure rolls back the status, password hash, and revocations together.
- Coordinate with refresh rotation and token issuance using the account row
  lock. Token issuance reloads active/verified state and rejects a stale
  credential snapshot. OAuth account resolution locks the user before any
  status update so stale account resolution cannot restore a disabled account.
- Subsequent protected API requests fail; other devices clear their local
  credentials when they next encounter the invalid session. There is no
  remote wipe of another device's offline data. Existing notification sockets
  already check account status before signals and periodically while idle.
  Previously authorized requests already in progress are not cancelled.

## Mobile flow

Profile → Account Settings → Deactivate account explains lost access, data
retention, and manual recovery. The screen uses existing `bg-surface`, text,
password input, button, and destructive confirmation components.

Users enter their current password, choose Deactivate account, and accept the
final confirmation. Pending requests prevent repeat submission and dismissal.
Failures remain visible in the confirmation; Go back allows password edits.
There is no automatic mutation retry.

Passwordless users follow the existing password setup/email recovery flow,
sign in with the new password, then return to deactivate. Linked accounts
with a usable password use the normal form. A session token alone is not
sufficient ownership proof for deactivation.

Confirmed server success reuses local logout cleanup: clear credentials,
authenticated user, server cache, app mode, merchant registration draft, and
account-scoped saved journey access. Session-generation guards prevent a late
response from clearing or redirecting a newer login.

If the server commits but the response is lost, the client cannot know whether
deactivation completed. The next protected request/session restoration will
reject the inactive account. This is not an offline deactivation feature.

## Retention and Merchant handling

Deactivation does not erase data, anonymize a profile, remove reviews/vouches,
hide public contributions, release the email, delete OAuth links, or alter
business/application status. Business listings remain subject to their existing
visibility rules. Their disabled owner cannot use protected management actions.
The screen states this before confirmation, including for an Explorer whose
Merchant application is pending. Business closure, transfer, and account/data
erasure are separate workflows.

## Manual reactivation

The existing administrator Reactivate User endpoint now accepts suspended or
disabled accounts. The web user detail page exposes its existing confirmation
and action for disabled users. Existing self-management and role restrictions
remain: Admins manage Explorers/Merchants; Super Admins additionally manage
Admins; neither can use this workflow on themselves or a Super Admin target.
Reactivation records the existing `user_reactivated` admin activity.

Sign-in, Google/Facebook account resolution, email verification, registration,
and password recovery do not reactivate disabled accounts. After manual review
and administrator reactivation, a fresh sign-in is required. Old JWTs stay
revoked. The unchanged plaintext password can be used again unless separately
reset. Self-service reactivation and a new support intake workflow are outside
this branch.

## Verification

Run from `sugbogo_backend` using the repository virtual environment:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.authentication apps.users.views.tests.test_profile_views apps.admin_operations.user_management --keepdb --noinput
```

Run from `sugbogo_frontend/mobile`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/features/auth/hooks/__tests__/useDeactivateAccount.test.tsx src/features/profile/screens/__tests__/DeactivateAccountScreen.test.tsx src/features/profile/screens/__tests__/ChangePasswordScreen.test.tsx src/features/auth/hooks/__tests__/useChangePassword.test.tsx src/features/auth/hooks/__tests__/useLogoutCommunity.test.tsx src/features/auth/hooks/__tests__/useLogoutOffline.test.tsx
```

Run from `sugbogo_frontend/web_app`:

```powershell
node --test src/features/admin-panel/users/components/detail/UserAccountActions.test.js
```

Manual QA should use disposable local accounts: cancel the confirmation, submit
a wrong password, retry correctly, verify old sessions are rejected, and restore
access through an authorized admin. Verify the merchant listing is retained,
passwordless setup guidance works, and keyboard/modal behavior on an emulator.
Live emulator, provider, email delivery, and multi-device QA must be reported
separately from automated verification.

### Recorded results

- Backend: 251 authentication, profile-view, and admin user-management tests
  passed; Django reported no system-check issues.
- Mobile: 29 tests across six deactivation, password, and logout suites passed.
- Web: three admin account-action rendering/permission tests passed.
- ESLint passed for all changed mobile and web source/test files; the new mobile
  screen, hook, and test files passed Prettier checks. `git diff --check` passed.
- Mobile `tsc --noEmit` still reports the same 24 existing errors in untouched
  files; none are in this branch's changed files.
- No application database migrations or demo seeds were run. Emulator,
  live email/provider, and multi-device verification remain outstanding.
