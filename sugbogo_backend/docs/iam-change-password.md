# Authenticated password change

Branch: `feat/iam-change-password`.

## API

`POST /api/auth/change-password/` requires an active authenticated account's JWT access token. It accepts:

```json
{
  "current_password": "the existing password",
  "new_password": "the replacement password",
  "confirm_password": "the replacement password"
}
```

The service locks and rereads the current account, checks the existing password, rejects an unchanged password, applies Django's configured password validators with the user's context, and atomically saves the password and blacklists all outstanding refresh tokens. The caller cannot select another account. Password text is not trimmed; the shared login serializer also preserves password whitespace so passwords created here remain usable.

Success is HTTP 200 with the established envelope:

```json
{
  "success": true,
  "message": "Password changed successfully. Please sign in again.",
  "data": null
}
```

Validation errors use HTTP 400 and the existing `VALIDATION_ERROR` envelope, with errors keyed by `current_password`, `new_password`, or `confirm_password`. Unauthenticated, inactive, and expired/revoked access tokens cannot use this endpoint. All active application roles can change their own password.

`has_usable_password` is added to serialized user profiles and mobile authentication responses. An OAuth link does not determine password availability: an OAuth-linked user may already have a usable password. Accounts without one must use the existing email recovery flow before they can use password change; possessing an access token alone does not establish a first password.

## Session behavior and rollout

`SIMPLE_JWT.CHECK_REVOKE_TOKEN` is enabled. New access/refresh tokens contain SimpleJWT's password-hash binding, and standard JWT authentication checks it against the current password. After a password change or password reset, access tokens issued for the old password are rejected immediately. The revoke-all helper also blacklists existing refresh tokens. No replacement tokens are returned by password change.

**Rollout effect:** tokens issued before this setting was enabled lack the binding and will fail protected-request authentication. Existing users need a fresh sign-in. Deploy the backend and updated mobile client together, and communicate the sign-in requirement. No database migration is needed.

This branch does not fix remember-me lifetime preservation during refresh, implement account lockout, or change logout to invalidate individual access tokens. Those remain separate tasks.

## Mobile flow

Account Settings now displays the signed-in email and a Security action. Password-bearing accounts can enter current/new/confirmation values, see inline validation or request failures, retry without losing their draft, and show/hide each password. Submission disables editing and duplicate requests; Back uses the existing unsaved-changes guard.

After success, the existing logout helper clears authentication, stored tokens, app mode, query caches, merchant registration draft, and account-scoped saved guidance. The app returns to login with success feedback. Session-generation checks prevent a delayed response from signing out a newer login.

For passwordless accounts, the screen explains email verification and offers **Continue to email recovery**. This explicitly signs out locally and opens the existing Forgot Password screen with the account email prefilled. The account owner must still receive and use the emailed reset link. Actual email delivery depends on the existing sender configuration.

Merchants can use this account-level feature through their existing Explorer profile access. No business-management action or visual redesign is introduced.

## Validation

- Passed: all 188 authentication and profile API tests (213.394 seconds), including the 13 new password-change tests. Django system checks found no issues.
- Passed: 20 focused mobile tests across five suites, including account password management, mutation lifecycle, login validation, session establishment, and logout cleanup.
- Passed: ESLint for all touched mobile files and `git diff --check`.
- TypeScript baseline comparison: 24 diagnostics at the starting commit and the same 24 after this change, with no introduced diagnostics. The project-wide type check remains blocked by those pre-existing issues.
- New API tests cover authentication, validation, password persistence, whitespace, OAuth-only/linked accounts, all active roles, suspension, transaction rollback, old access/refresh rejection, and fresh login.
- Mobile behavior tests cover Account Settings navigation, validation and retry, pending state, passwordless recovery guidance, successful cleanup, failed-request preservation, and stale-session responses.
- Related authentication/profile regressions and mobile cleanup/login tests are run alongside the new tests.
- Device keyboard behavior, largest system text size, landscape, and screen-reader behavior still require a device/emulator pass. Automated component tests do not establish visual QA on those configurations.
