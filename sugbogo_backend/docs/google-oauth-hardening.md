# Google OAuth verification and linking

## Confirmed causes and scope

The mobile flow is `useGoogleAuth` -> Expo AuthSession authorization/code exchange ->
`authentication.idToken` -> `googleLogin` -> `/api/auth/google-login/` ->
`GoogleLoginSerializer` -> `GoogleOAuthService` -> `OAuthAccountService` ->
`issue_tokens`. Google and Facebook share account resolution, but the new linking
restrictions apply only to Google.

- `GOOGLE_OAUTH_CLIENT_ID` is loaded with `os.getenv` and can be `None` or blank.
  Google Auth documents that an audience of `None` disables audience verification.
- The Google adapter previously checked only truthy `sub` and `email` values,
  without checking their types or `email_verified`.
- Email fallback could activate and verify an existing account, then use
  `update_or_create` to replace its existing provider subject.
- An existing subject could verify the stored account email even if the token
  referred to a different email address.

Sources:

- [Google Auth audience verification](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html)
- [Google ID token verification and email authority](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Google OpenID claims, including the documented string `"true"` example](https://developers.google.com/identity/openid-connect/openid-connect)

## Security behavior

| Situation | Previous behavior | Hardened behavior |
| --- | --- | --- |
| Missing/blank audience | Could skip audience verification when `None` | Google login returns 503 `GOOGLE_SERVICE_UNAVAILABLE` before calling Google |
| Wrong token audience | Rejected when an audience was configured | Still rejected, always with an explicit nonblank configured audience |
| Missing/false email verification | Could create, link, activate, or log in | 401 `INVALID_GOOGLE_TOKEN`, including for existing subjects |
| Malformed subject/email | Truthy values could pass into account resolution | Rejects unusable types, invalid emails, and values exceeding the existing field limits |
| Existing provider subject | Resolves linked account first | Preserved, including third-party emails and changed email claims |
| Gmail/Workspace email matches an unlinked account | Automatically links and activates | Preserved after verified claims and role/status checks |
| Third-party email matches an existing account | Automatically links | 403 `OAUTH_LINK_REQUIRED`; existing account method is required |
| Matching email but a different Google subject is already linked | Could replace the old subject | 403 `OAUTH_LINK_REQUIRED`; old association stays intact |
| Linked subject, different email, pending/unverified local account | Could verify unrelated stored email and activate | 403 `OAUTH_LINK_REQUIRED`; no activation or verification writes |
| New verified Google identity with no email collision | Creates active Explorer with unusable password | Preserved, including third-party addresses |
| Suspended/disabled or administrative account | Denied | Existing checks remain before linking or activation |

Only boolean `true` and the literal string `"true"` count as verified. Generic
truthiness, including `"false"` or integer `1`, is insufficient. Email authority
requires a Gmail suffix or a nonblank string `hd` claim from the verified Google
payload. Google warns that initial verification of a third-party address does not
establish its current ownership, so that claim alone cannot link an existing account.
Existing subject associations remain the primary identity key.

No new linking endpoint or recovery mechanism is introduced. Users denied unsafe
automatic linking must use their existing sign-in method. Signing in that way does
not itself create a Google association. The current mobile error handler displays
a generic Google sign-in failure; it does not present the new error code specially.

## Railway configuration and mobile compatibility

`GOOGLE_OAUTH_CLIENT_ID` must be a single nonblank OAuth client ID matching
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` in the shipped Android build.

Evidence from the inspected mobile source and installed Expo AuthSession:

- `src/features/auth/oauth/google.ts` passes only `androidClientId`, the custom
  redirect URI, and OpenID/profile/email scopes to `Google.useAuthRequest`.
- Expo's `src/providers/Google.ts` selects `androidClientId` on Android and uses
  the selected `clientId` for both the authorization request and code exchange.
- `src/features/auth/hooks/useGoogleLogin.ts` forwards `authentication.idToken`.
- `src/config/oauth.ts` exports a web client ID, but the active hook does not use it.

This identifies the expected audience for the inspected Android implementation;
the deployed Railway value and environment baked into the distributed mobile build
were not inspected. Confirm those two values match before rollout, and smoke-test
the distributed build. Do not assume that Google's native SDK examples requiring
a web/server client ID describe this Expo AuthSession implementation. No audience
allowlist, mobile edits, or Railway variable changes are included.

Returning linked users and authoritative Gmail/Workspace links retain the current
flow. Third-party email collisions, unverified claims, provider-subject replacement,
and activation using a different stored email now fail intentionally. Other platform
clients are not added speculatively.

## Deployment and rollback

- No database schema changes or migrations are required. JWT lifetimes and other
  authentication mechanisms are unchanged.
- Before deployment, verify the audience setting against the shipped Android build.
  After deployment, smoke-test returning Explorer and Merchant sign-ins, new signup,
  and an intended email link with that build. Confirm restricted accounts remain denied.
- Monitor existing response codes/outcome counts for unexpected 401, 403, and 503
  changes without recording tokens, provider payloads, or credentials.
- A code rollback requires no data rollback, but restoring the old verifier/linker
  reintroduces these vulnerabilities. Prefer correcting the audience configuration
  or rolling back unrelated changes while retaining this patch. If an emergency
  rollback is unavoidable, block Google login until the secure implementation is
  restored; a blank audience is unsafe with the previous code.
- Existing associations are preserved. This patch does not prove the historical
  legitimacy of links created before the fix or revoke existing JWT sessions.

No commit, push, deployment, or Railway configuration mutation is performed by
this implementation task.

## Modified files

All paths below are relative to `sugbogo_backend`:

- `apps/authentication/services/oauth/google.py`: fail-closed audience and claim verification.
- `apps/authentication/services/oauth/base.py`: default-false email-authority metadata.
- `apps/authentication/services/oauth/account.py`: Google linking and stored-email verification guards.
- `apps/authentication/views/google_login.py`: controlled 503 for missing audience configuration.
- `config/settings.py`: clarify the existing audience setting.
- `.env.example`: document the Android AuthSession audience relationship.
- `apps/authentication/tests/test_google_oauth_service.py`: claim tests and real audience verification with mocked certificates.
- `apps/authentication/tests/test_google_oauth_security.py`: end-to-end adapter/linking regression tests with mocked Google verification.
- `apps/authentication/tests/test_google_login.py`: mark the mocked identity as authoritative for existing safe-link scenarios.
- `apps/authentication/tests/test_oauth_error_handling.py`: retain pending activation coverage using the same stored email.
- `apps/authentication/tests/test_account_lockout.py`: explicit authoritative mock for Google recovery via email matching.
- `apps/authentication/tests/test_login_history.py`: explicit authoritative mock for Google login via email matching.
- `docs/google-oauth-hardening.md`: findings, behavior, configuration, compatibility, validation, and rollout notes.

## Validation results

- Initial focused run: **41 tests passed** with normal settings, covering
  `test_google_oauth_service`, `test_google_oauth_security`, `test_google_login`,
  and `test_oauth_error_handling`.
- Expanded regression run: **300 tests passed** across `apps.authentication.tests`
  and `core.tests.test_production_settings` (19.755 seconds excluding setup).
  The expanded run used a process-only override to Django's `MD5PasswordHasher`,
  matching the existing authentication concurrency-test convention. It exercises
  account/session logic without the cost of production password hashing; the
  repository's password-hasher configuration was not edited. An initial expanded
  run with normal hashing was stopped for runtime before this complete rerun.
- Tests used a dedicated generated local PostGIS test database. Google verification
  was mocked; the real Google audience-verification regression used a locally
  signed token with mocked certificate retrieval and made no Google requests.
- `python manage.py check`: **no issues**. Both completed test runs also reported
  no Django system-check issues.
- AST parsing and in-memory compilation: **all 11 modified/new Python files passed**.
- `git diff --check`: **passed**.
- No Python lint configuration or installed Ruff, Black, or Flake8 executable/module
  was found; no separate linter run is claimed.
- Live Railway configuration and sign-in using a distributed mobile build were
  not tested. The deployment checks above remain necessary.
