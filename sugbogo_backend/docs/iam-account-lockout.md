# IAM temporary password lockout

`feat/iam-account-lockout` builds on `feat/iam-login-history`. It adds a temporary
password-sign-in restriction without changing the user's account status.

## Approved policy

- Five incorrect passwords in a fixed 15-minute observation window trigger a
  fixed 15-minute password lock. The window begins with the first incorrect
  password; it is not a sliding window.
- The fifth failure receives the lock response. During a lock, password attempts
  are rejected before hashing/checking the submitted password. They do not add
  failures or extend the deadline. At the expiry boundary, the next attempt
  starts from cleared state.
- Counters belong to `USER_ID`, shared across mobile and admin password login,
  case variants, email changes, and source IPs. Existing IP request throttles
  remain independent and may reject a request before account processing.
- Only active, verified accounts with usable passwords accumulate failures.
  Unknown addresses create no account/counter record. Inactive, unverified,
  malformed, and OAuth-only login behavior retains its existing restrictions.
- A completed eligible sign-in clears the state. Proving a correct password in
  the wrong portal does not clear failures or update `last_login`.
- Google/Facebook sign-in remains available after provider verification and
  existing role/status checks. A successful OAuth sign-in clears the temporary
  password restriction as authenticated recovery.
- Verified password reset and authenticated password change also clear the
  state, retaining their existing session-revocation behavior. Merely requesting
  a reset, presenting an invalid reset token, or entering a wrong password does
  not unlock the account. Reset proof is rechecked after acquiring the user lock.
- Existing access/refresh sessions continue working. Lockout does not suspend,
  disable, reactivate, or otherwise change account eligibility.

Settings in `config/settings.py` are `LOGIN_LOCKOUT_THRESHOLD` (5),
`LOGIN_LOCKOUT_WINDOW_SECONDS` (900), and `LOGIN_LOCKOUT_DURATION_SECONDS` (900).

## Persistence, transactions, and history

Migration `users.0017_user_user_login_failure_count_and_more` adds
`USER_LOGIN_FAILURE_COUNT`, `USER_LOGIN_WINDOW_STARTED_AT`, and
`USER_PASSWORD_LOCKED_UNTIL`. State survives process restarts and cache clears.
Expiry is handled on the next eligible attempt; it needs no background task.

Password login holds a `select_for_update()` lock on the user from password
validation through portal eligibility and token issuance. Concurrent attempts
cannot lose increments or issue a password session after another attempt has
established a lock. Successful token issuance, clearing counters, updating
`last_login`, and recording the success event share the transaction. A failed
issuance rolls back those success changes. Recovery and refresh use the same
user-row locking convention.

Lock-triggering and blocked password requests are unsuccessful login events
through the existing history recorder. They do not advance `last_login` or
issue new tokens. Framework throttles still run before endpoint history.

## API and frontend behavior

Existing mobile/admin login endpoints return the standard error envelope with
HTTP 429, code `ACCOUNT_LOCKED`, numeric `errors.retry_after`, and `Retry-After`.
The delay is rounded up from the remaining fixed server deadline. No attempt
count, credentials, or permanent account status is returned in this response.
Ordinary credential failures retain `INVALID_CREDENTIALS`; IP throttles retain
`RATE_LIMIT_EXCEEDED`.

Mobile and admin forms distinguish the account restriction from an IP throttle,
display a recoverable countdown, and disable password submission only for the
affected normalized email. Changing to another email is allowed. Countdown time
uses a deadline so delayed/background timer callbacks catch up. Reloading the
form can reset local presentation, but cannot bypass the database restriction.
Forgot Password stays available; mobile social sign-in stays available during
an account lock. Existing global rate-limit behavior is preserved.

Known locked accounts return a distinct response from unknown addresses. This
branch does not claim full account-enumeration resistance; existing OAuth,
verification, and status errors also remain unchanged. Deliberate lockout of a
known address remains possible, mitigated by the fixed non-extending deadline,
available verified recovery, OAuth, and existing sessions. Broader abuse
detection, MFA, trusted proxy configuration, and resetting UI timers immediately
from another device's recovery are outside this branch.

## Rollout and verification

From `sugbogo_backend`, apply the migration before serving this version:

```powershell
..\.venv\Scripts\python.exe manage.py migrate
```

Automated verification:

```powershell
..\.venv\Scripts\python.exe manage.py test apps.authentication.tests.test_account_lockout --keepdb --noinput
..\.venv\Scripts\python.exe manage.py makemigrations authentication users --check --dry-run
```

Tests cover threshold sharing across portals/IPs/case, non-extension and hash
avoidance while locked, expiry/window boundaries, wrong-portal behavior,
Admin/Super Admin eligibility, recovery, existing sessions, and login history.
Two tests use real parallel PostgreSQL connections: simultaneous failures at
the threshold, and an incorrect attempt arriving during successful token
issuance. Those concurrency tests use fast hashing to keep the synchronization
checks independent of password-hasher performance.

Manual QA should use disposable Explorer, Merchant, and admin accounts. Trigger
the threshold, check blocked retry, switch identities, try recovery/OAuth, and
verify suspended/disabled accounts remain inaccessible after expiry or reset.
Check mobile background/resume and admin browser feedback. Application migrations,
live provider delivery, and emulator/browser interaction QA are separate from
automated verification. My Pockets and development seed files are unchanged.

### Recorded results

- Full authentication, profile, and admin management regression run: 303 tests
  passed, using a fast password hasher confined to that test process.
- Focused lockout run: all 11 tests passed with normal application hashing for
  the API/recovery tests and an explicit fast-hasher override for the two
  PostgreSQL concurrency tests.
- Mobile: 19 tests passed across the login, login-history, and email-change
  regression suites. A final three-test login rerun also passed after adding
  background-clock catch-up coverage.
- Mobile TypeScript reported zero errors. Changed-file mobile and web ESLint,
  authentication/users migration consistency, and Git whitespace checks passed.
- Admin web production build passed. Its normal build emitted existing Lottie
  dependency and chunk-size warnings; these were not changed in this branch.
- Application database migrations, live OAuth/recovery delivery, and interactive
  emulator/browser QA were not performed. No new packages or native rebuilds
  are required.

The policy follows the account-scoped counters and available recovery approach
described in the [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout).
The specific threshold, observation window, duration, and password-only scope
were approved for this branch rather than treated as universal defaults.
