# IAM login history

`feat/iam-login-history` builds on the email-change and mobile TypeScript branches.
It records authentication outcomes and adds Profile → Account Settings → Login
history using the existing mobile components, navigation, and `bg-surface`.

## Recording and access

- Password/mobile, admin password, Google, and Facebook endpoints record one
  outcome for each attempt reaching endpoint validation: `success`, `failed`, or
  `unavailable` for a provider service failure.
- A success event, `User.last_login`, and the refresh-token registration commit
  in the same transaction, after account, credential, and portal eligibility
  checks. A failed history write rolls back session creation. Renewal, logout,
  password recovery, and email confirmation do not count as interactive logins.
  Existing remember-me limits and session revocation remain in place.
- Rejections do not update `last_login`. Validation failures are recorded without
  account attribution. Framework authentication, permission, and throttle
  rejection before endpoint execution are outside these records; unexpected
  internal errors are handled by existing error logging, not classified as bad
  credentials. Django's separate built-in admin login is outside these endpoints.
- Password failures are associated with a known account only after validating
  the login payload. Unknown email addresses are not retained. OAuth failures
  are associated only after provider verification, resolving an existing provider
  link before a verified email. Invalid provider tokens and provider outages
  remain anonymous regardless of a caller-supplied email.
- `GET /api/auth/login-history/` requires authentication and always scopes to
  `request.user`. It accepts standard `page`/`page_size` parameters and returns
  the existing `{success, message, data: {items, pagination}}` envelope. Each
  item exposes `id`, `method`, `outcome`, `created_at`, `platform`, `client`, and
  nullable `ip_address`. Ordering is newest timestamp then newest ID. Caller
  account filters cannot expand access. Admins also receive only their own data;
  no cross-account audit endpoint is introduced.

## Metadata and retention

The approved retention period is **90 days**, configured by
`LOGIN_HISTORY_RETENTION_DAYS`. Reads exclude expired records immediately.
`apps.authentication.tasks.prune_login_history` runs through the existing Celery
Beat schedule daily at 04:00 in the configured Celery timezone. A worker and Beat
must be running for automatic physical deletion. Cleanup works in batches of
1,000, is idempotent, and retries transient database failures. Physical records
may remain until the next successful cleanup; backups have their own retention.
An operator can also run:

```powershell
..\.venv\Scripts\python.exe manage.py prune_login_history
```

Only allowlisted client/platform labels are stored, never raw user-agent text.
These approximate labels are not trusted device identities. IP uses only a
validated `REMOTE_ADDR`; forwarded headers are ignored. Behind a proxy this may
be the proxy address. Establishing a trusted proxy configuration remains a
separate deployment task. The screen does not infer physical location from IP.
There are no stored passwords, raw tokens, request bodies, attempted email
strings, or provider subject identifiers in login events. Account-attributed
events are deleted if the owning user is deleted; deactivation retains them
under the same 90-day policy.

## Mobile behavior

- Read-only, growing history with pull-to-refresh and server pagination.
- Separate loading, empty, request-error, refresh-error, and next-page-error
  states. Loaded rows remain available during refresh or pagination failures.
- Query keys isolate accounts; session-generation checks reject late responses
  after logout or session replacement. Existing logout clears query caches.
- Events begin after rollout. Historical `last_login` or login events are not
  fabricated or backfilled, and this screen is not a live session/device list.
- My Pockets is outside this branch and has not been changed.

## Rollout and validation

Migration `authentication.0005_loginevent` creates the event table and indexes.
Apply migrations before serving this version of the login endpoints:

```powershell
..\.venv\Scripts\python.exe manage.py migrate
```

From `sugbogo_backend`, run:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.authentication apps.users.views.tests.test_profile_views apps.admin_operations.user_management --keepdb --noinput
..\.venv\Scripts\python.exe manage.py makemigrations authentication users --check --dry-run
```

From `sugbogo_frontend/mobile`, run:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/features/profile/hooks/__tests__/useLoginHistory.test.tsx src/features/profile/screens/__tests__/LoginHistoryScreen.test.tsx src/features/profile/screens/__tests__/ChangeEmailScreen.test.tsx
```

Manual QA: sign in successfully, make an unsuccessful attempt against the same
account, then inspect history while signed in. Test two accounts, pagination,
offline retry, and large text. Google/Facebook provider behavior is mocked in
automated tests; live provider, emulator, and running worker/Beat verification
must be checked separately. Application migrations and demo seeds are not run
as part of the automated test suite.

### Recorded results

- Fresh full regression run: 292 authentication, profile, and admin management
  tests passed. This run temporarily overrode `PASSWORD_HASHERS` with Django's
  fast MD5 test hasher inside that process only; application configuration was
  not changed.
- All 12 focused login-history tests also passed separately with the normal
  application password hashing, including recording, ownership, rollback,
  retention boundary, command cleanup, and scheduled-job idempotency checks.
- All 16 mobile tests across the history hook, history screen, and email-change
  regression suites passed and exited normally.
- Mobile TypeScript reported zero errors; ESLint passed for changed mobile
  files. The authentication/users migration consistency check and Git whitespace
  checks passed.
- Application migrations, live provider sign-in, emulator UI, and deployed
  worker/Beat execution were not performed.
