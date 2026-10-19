# IAM session policy

Branch: `fix/iam-session-policy`, based on committed password-change work `67b793c6`.

## Purpose

Preserve the original sign-in deadline during refresh rotation, validate the current account/password before renewal, and connect mobile and web logout to server-side refresh revocation. This branch reuses the established JWT, blacklist, response, and client cleanup patterns. It introduces no model, migration, dependency, or visual redesign.

## Defined behavior

| Event | Result |
| --- | --- |
| Password login, remember-me off | Refresh expires 12 hours after sign-in. |
| Password login, remember-me on | Refresh expires 30 days after sign-in under the current global setting. |
| Google/Facebook login | Existing remember-me-on behavior remains. |
| Refresh | Rotates JTI, blacklists the old refresh token, and preserves its exact original `exp`. Access lifetime is at most 15 minutes and cannot exceed that deadline. |
| Password change or reset | Existing password binding invalidates access tokens for the old password; all existing refresh tokens are blacklisted. Refresh also explicitly checks the password binding. |
| Account suspended/disabled/deleted, or no longer email-verified | Refresh is rejected; inactive accounts cannot use protected JWT endpoints. |
| Successful ordinary logout | Only the submitted refresh token is blacklisted. Other independent logins remain valid. |
| Ordinary logout access-token limit | A copied access token can remain valid for its remaining lifetime, at most 15 minutes and never beyond its issued expiry. This is not immediate per-device access-token revocation. |
| Offline/unavailable logout | Local authentication and account-scoped data are cleared immediately; refresh revocation is best effort, with a 5-second request timeout. A copied refresh token not successfully revoked can remain valid until its original deadline. |
| Network/timeout/429/5xx during refresh | Credentials remain available for retry; service unavailability is not treated as proof that the session was revoked. |

Durations are **absolute sign-in limits**, not sliding idle windows. Rotation never adds another 12 hours or 30 days. Existing tokens retain the expiry they already contain; an already-extended legacy token cannot be reconstructed back to an unknown earlier login policy. A fresh login starts the corrected policy.

## Backend implementation

- `apps/authentication/utils/jwt.py` updates the registered `OutstandingToken` payload and expiry after applying the short lifetime. Initial access tokens are also bounded by refresh expiry.
- `apps/authentication/session_serializers.py` validates and rotates under a user-row lock, rereads blacklist state after acquiring the lock, rejects missing/deleted/inactive/unverified accounts, and checks the password-hash binding before issuing tokens.
- `apps/authentication/views/token.py` uses the scoped serializer while preserving `/api/auth/refresh/` and its unwrapped `{access, refresh}` response contract. Errors keep the existing exception envelope.
- `apps/authentication/services/session_service.py` coordinates single-token logout and revoke-all with the same account lock used by rotation and password change.
- `apps/authentication/views/logout.py` preserves the public refresh-possession contract, HTTP 205 success, and HTTP 400 invalid/already-blacklisted response.

The blacklist is SQL-backed. No cache-only revocation state or new JWT signing secret is introduced. Normal account/user permissions continue to use the current database role and status.

## Mobile and web

Mobile and web capture the old refresh credential and make a bounded best-effort logout request through the public auth client. They never refresh an expired access token merely to log out. Local cleanup does not wait for the remote request, and a delayed revocation result does not affect a newer sign-in.

Mobile refresh now rejects non-success HTTP responses and malformed success payloads before token persistence. Existing single-flight refresh, generation checks, serialized SecureStore mutations, cache cleanup, offline-data cleanup, and app-mode reset are retained. The API interceptor preserves credentials when refresh encounters throttling or a server error.

Web refresh is shared only within the same tab login generation. Login/logout changes that generation, while refresh rotation preserves it. A response after logout/account switch is rejected as stale before writing storage; stale failures cannot clear a newer account. A delayed 401 from a concurrent request can reuse the already-rotated access token without starting another refresh. Transient failures preserve the current session for retry.

There is no new Remember Me control on mobile; its current password login continues to use the backend default of false. Existing Admin web selection and OAuth behavior remain intact.

## Scope limits

Immediate per-device access-token revocation would need a separate persistent session identifier/revocation check; this branch does not claim to implement it. Cross-tab refresh coordination and a user-facing device/session list remain outside scope. If server rotation completes before a best-effort logout submits an older refresh token, the old token is rejected as already used; client stale-response guards prevent storing the late rotated credentials locally. This is not a guarantee of revoking every copied descendant refresh token during network races.

The separate untracked demo seeder and audit review files are not part of this branch task. No application migrations or demo data were applied by this work.

## Verification

Run backend tests from `sugbogo_backend`:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.authentication.tests apps.users.views.tests.test_profile_views --noinput
```

Run the focused mobile suites from `sugbogo_frontend/mobile`:

```powershell
npx jest --runInBand --watch=false src/features/auth/api/__tests__/token.service.test.ts src/features/auth/hooks/__tests__/useLogoutCommunity.test.tsx src/features/auth/hooks/__tests__/useLogoutOffline.test.tsx src/features/auth/hooks/__tests__/useChangePassword.test.tsx src/shared/api/__tests__/apiClient.test.ts src/shared/api/__tests__/apiClientOffline.test.ts src/shared/api/__tests__/refresh.test.ts src/shared/api/__tests__/storage.test.ts
```

Run the web behavior tests from `sugbogo_frontend/web_app`:

```powershell
node --test src/features/auth/utils/authSession.test.js
```

Tests cover repeated rotation for both lifetimes, expiry bounding, SQL token registration, deleted/unverified/suspended users, password-bound refresh rejection, password reset, independent logins, logout behavior, client cleanup without a reachable server, HTTP error classification, and stale refresh responses. API/hook tests are not physical-device, deployed-network, or concurrent browser-tab acceptance.

### Recorded results

- **198 backend authentication/profile tests passed** in 183.642 seconds, including 10 new session-policy API tests. Django system checks reported no issues.
- **49 mobile tests passed** across eight focused suites. After the final Axios import cleanup, the two affected API-interceptor suites were rerun and all 12 tests passed; these overlap with the 49 and are not additional unique coverage.
- **9 web behavior tests passed** using the existing Vite/Node test approach and mocked HTTP transport.
- ESLint passed for the touched mobile and web files. Python syntax checks and `git diff --check` passed.
- The full mobile TypeScript check still reports the same 24 previously recorded errors in untouched areas; none were reported in the changed/new session-policy files.
- No local application data was seeded or migrated. No live email/OAuth test, device acceptance, or multi-tab browser verification was performed.
