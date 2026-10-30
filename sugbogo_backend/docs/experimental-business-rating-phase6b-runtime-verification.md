# Phase 6B — Live business rating verification

Verified October 30, 2026, Asia/Manila. Stored aggregate timestamps below are UTC.

## Verdict

**READY FOR DEVELOPMENT USE.** Current development worker registration, default queue routing, actual Beat delivery, real Redis/Celery recalculation, authenticated HTTP serialization, and an already-mounted mobile rating component have been verified.

Physical-device/full-screen acceptance remains unverified: ADB reported no connected devices. This report does not approve public-production release or sentiment quality.

## Root cause and operational correction

The worker and Beat were running code/configuration loaded October 26, before the rating implementation. They do not automatically reload when Python source or Beat settings change.

- Worker PID 22272 ran `celery.exe -A config worker -P solo -l info`.
- Beat PID 15712 ran `celery.exe -A config beat -l info --schedule .venv\celerybeat-r7c-py312`.
- Both used the existing backend virtual environment. Their startup commands and creation dates were inspected through Windows process metadata.
- A fresh local Celery application discovered all three rating tasks. The old worker reported none. This rules out broken task discovery as the observed cause.
- The actual running Beat schedule was `.venv\celerybeat-r7c-py312`, not the older schedule files at the repository root. Its persisted entries lacked both rating schedules.

After verifying that the worker had no active/reserved tasks and all four Redis priority lanes for `celery` were empty, the old worker received a targeted warm shutdown. The verified old Beat process was stopped. Both development services were restarted with the current repository code and the same application/schedule path. No implementation/configuration fix was needed.

The development services were left running in hidden windows, with output captured in `.analytics-demo/phase6b/main-worker*.log` and `main-beat*.log`.

## Current worker, queues, Beat, and database

Application configuration remains `config`, exporting `config.celery.app` through `config.celery_app`; Django settings use the `CELERY_` namespace and `autodiscover_tasks()`.

The refreshed `celery@Ralphskie` worker registers:

```text
apps.reviews.tasks.recalculate_business_rating
apps.reviews.tasks.recover_business_ratings
apps.reviews.tasks.reconcile_business_ratings
```

It consumes the `celery` queue with direct exchange/routing key `celery`; no custom application task routes are configured. Eager execution is disabled. Broker remains `redis://127.0.0.1:6379/0`; no production service or broker configuration was changed.

Beat logs and worker logs show matching deliveries/completions of:

- `recover-business-ratings` → `apps.reviews.tasks.recover_business_ratings`, every 60 seconds.
- `reconcile-business-ratings` → `apps.reviews.tasks.reconcile_business_ratings`, every 300 seconds.

For example, the default worker received and completed reconciliation task `0d5b4791-d226-4d6c-8879-c7beb8162398` after Beat dispatched it. These checks used the actual running development services, not a scheduler mock.

Development migrations remain current, including reviews `0029` and `0030`; MigrationExecutor reported zero pending migrations. Experimental exposure and automatic updates remain enabled. The default and all existing aggregates select `legacy-unverified-v1`; calculation remains `signed-average-v1`.

At the integrity check, the development database retained 15 aggregates: four ready, eleven insufficient, zero outstanding revisions. A SHA-256 comparison of IDs, text, status, sentiment fields, and update timestamps confirmed all 63 existing review rows were unchanged.

## Controlled live execution

Writes were confined to newly created disposable PostgreSQL databases, using the existing server, migrations, application code, local inference assets, and Redis service. A private Redis key prefix and queue prevented fixture IDs from reaching the development worker.

The successful run used:

- Database `test_sugbogo_phase6b_0fc78c534f`.
- Worker `phase6b_0fc78c534f@Ralphskie`, solo pool, concurrency 1.
- Queue `phase6b_0fc78c534f`, Redis prefix `phase6b:0fc78c534f:`.
- Actual Django HTTP server at `127.0.0.1:18006`, authenticated with a temporary fixture-owner JWT.
- Real Beat scheduler with the repository's unchanged 60/300-second rating intervals. Unrelated periodic jobs were excluded from this isolated scheduler.

The five starting fixture scores were deliberately seeded as 0.75. New positive/negative reviews and the accepted edit used actual existing sentiment inference in a separate Celery worker process; their scores were not mocked or pre-assigned.

Publication used the existing shared administrative publication service. Accepted-edit moderation supplied a controlled safe verdict; external moderation-provider availability was not tested. Sentiment processing, rating dispatch, task execution, database writes, Beat recovery, and authenticated API reads were real.

| Scenario | Contributors | Stored value | API value | Requested/completed |
| --- | ---: | ---: | ---: | --- |
| Initial automatic fixture calculation | 5 | 4.5000000000 | 4.5 | 2/2 |
| Published negative review, inferred score -0.9287 | 6 | 3.9404333333 | 3.9 | 4/4 |
| Published positive review, inferred score +0.9423 | 7 | 4.0753142857 | 4.1 | 6/6 |
| Author deletes the negative review | 6 | 4.5641000000 | 4.6 | 7/7 |
| Accepted edit to negative text, then real rescore | 6 | 3.9413333333 | 3.9 | 9/9 |
| Producer delivery fails, then Beat recovery | 6 | 3.9413333333 | 3.9 | 10/10 |
| Aged snapshot repaired by normal five-minute reconciliation | 6 | 3.9413333333 | 3.9 | 11/11 |

For each completed row, the probe independently checked the selected input count/average against the stored aggregate, then read the authenticated Explorer detail HTTP endpoint and checked the serialized count, value, and scoring version.

Accepted-edit invalidation was observed while only the fixture queue was paused: the old sentiment was cleared, and the API returned `pending` with a null numeric value. Consumption resumed, and the worker rescored/recalculated the edited text.

Delivery failure was a real refused connection to `127.0.0.1:1`, scoped to one fixture producer call. Shared Redis was not stopped. Demand remained at requested revision 10, completed revision 9. The normal 60-second Beat job `03a78f82-8c27-4482-96e2-288100615a8e` redispatched one business; task `5ac2b8c4-bd38-4efe-a41c-bfe860cdef72` completed revision 10 at `07:53:05.694612Z`.

Only the fixture aggregate's timestamp was then aged. The normal 300-second reconciliation advanced it to revision 11 at `07:56:05.699977Z`. Its value/count still matched the available inputs. No reconciliation interval was shortened.

## Mobile and API result

The opt-in `BusinessRatingRuntime.test.tsx` mounted the actual `ReviewDerivedDataSyncProvider` and `BusinessSentimentRating` once, sharing the existing detail query key. It used real timers and authenticated HTTP responses from the fixture Django server.

The mounted component first displayed `4.5/5 · 5 scored reviews`. It began the same rating observation used after a client-known mutation, signalled fixture publication, and then displayed `3.9/5 · 6 scored reviews` without remounting or manual refresh. The runtime test passed in approximately 6.7 seconds of test execution.

The test supplies Node's HTTP transport in place of native networking. It does not mock rating responses or Celery/inference results. It verifies the actual mobile query/synchronization/presentation code against live backend output, but does not exercise the full native screen, Axios/native storage, sign-in flow, navigation container, or physical device.

No additional polling or per-card requests were introduced. Independent remote writes outside a client-known observation window do not produce server push; an idle mounted profile/card may require a later focus, reconnect, or refresh. The existing two-minute rating observation remains bounded.

## Historical sentiment, kept separate

| Business ID | Review ID missing sentiment | Current eligible contributors | If that review became eligible | Threshold affected? |
| --- | --- | ---: | ---: | --- |
| 4 | 24 | 0 | 1 | No; still below five. |
| 5 | 22 | 1 | 2 | No; still below five. |

Both published reviews predate the normal 30-day recovery population. They remain a historical inference gap. They were not rescored, edited, deleted, or otherwise modified. Aggregate recovery does not itself fill missing sentiment.

## Commands used

Commands below use PowerShell. The backend working directory was `C:\Users\Angela\Desktop\SugboGo\SugboGo\sugbogo_backend`.

Process inspection:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'celery|manage.py|expo' } | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine | Format-List
```

The targeted worker shutdown was sent from the configured Django/Celery runtime:

```python
celery_app.control.broadcast("shutdown", destination=["celery@Ralphskie"])
```

The old Beat identity was checked before `Stop-Process -Id 15712`. The replacement commands were launched through `Start-Process -WindowStyle Hidden`, with the existing backend working directory and separate stdout/stderr log files:

```powershell
.\.venv\Scripts\python.exe -m celery -A config worker -P solo -l info
.\.venv\Scripts\python.exe -m celery -A config beat -l info --schedule .venv\celerybeat-r7c-py312
```

Post-start inspection used `celery_app.control.inspect()` for registration, active queues, worker stats, active/reserved tasks, and ping. The equivalent CLI commands are:

```powershell
.\.venv\Scripts\python.exe -m celery -A config inspect registered --timeout=5
.\.venv\Scripts\python.exe -m celery -A config inspect active_queues --timeout=5
.\.venv\Scripts\python.exe -m celery -A config inspect ping --timeout=5
```

The local verification harness remains in the ignored audit-artifact directory. It refuses mutation of a database without the disposable test prefix. Preparation applies migrations only to its newly created database:

```powershell
.\.venv\Scripts\python.exe -u .analytics-demo\phase6b\runtime.py prepare
.\.venv\Scripts\python.exe -u .analytics-demo\phase6b\runtime.py run
```

While `run` reports `ready-for-mobile`, a separate shell in `sugbogo_frontend\mobile` runs:

```powershell
$env:SUGBOGO_RATING_RUNTIME_STATE = 'C:\Users\Angela\Desktop\SugboGo\SugboGo\sugbogo_backend\.analytics-demo\phase6b\state.json'
npm.cmd test -- --runInBand --watch=false --runTestsByPath src/features/explore/hooks/__tests__/BusinessRatingRuntime.test.tsx
```

Additional focused checks:

```powershell
npm.cmd test -- --runInBand --watch=false --runTestsByPath src/features/explore/hooks/__tests__/BusinessRatingSync.test.tsx
.\node_modules\.bin\eslint.cmd src/features/explore/hooks/__tests__/BusinessRatingRuntime.test.tsx
```

Results: live mobile integration **1 passed**, existing rating synchronization regressions **15 passed**, focused ESLint **passed**, whitespace check **passed**. The new runtime test is skipped when its explicit environment variable is absent; that opt-in guard was also checked. No full project suite was run.

The first fixture attempt exceeded a 60-second service startup budget before running its scenarios. The audit harness startup allowance was increased and the probe rerun successfully. This was not an application task-discovery defect.

Cleanup stopped only the fixture process trees after checking their `runtime.py` role commands. It dropped only the two databases named in the audit receipts, after verifying they had no active connections; removed only Redis keys matching their exact private prefixes; and removed temporary JWTs from saved state. No `FLUSHDB`, development queue purge, or existing review cleanup was performed. No Phase 6B test database remains.

## Physical-device manual verification

ADB was available at `C:\Users\Angela\AppData\Local\Android\Sdk\platform-tools\adb.exe`. The following command started its daemon and returned an empty device list:

```powershell
$env:ANDROID_USER_HOME = 'C:\Users\Angela\.android'
& 'C:\Users\Angela\AppData\Local\Android\Sdk\platform-tools\adb.exe' devices -l
```

For physical acceptance:

1. Connect/unlock an approved Android development device, enable USB debugging, accept its authorization prompt, and confirm it appears as `device` in `adb devices -l`.
2. Keep the verified worker and one Beat instance running. If the API is not already running, use the README command from the backend: `.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000`.
3. Keep phone and backend on the same reachable LAN. Mobile currently uses `EXPO_PUBLIC_API_URL=http://172.20.10.2:8000/api`. Confirm the current address before starting Expo; no `.env` change was made by this audit.
4. From mobile, use the established `npx.cmd expo start --dev-client` command and open the installed SugboGo development build. Sign in with an approved fixture account.
5. Use an explicitly approved fixture business with at least five scored published reviews. Open its profile, note the server value/count, then use its normal review submission or accepted text-edit flow and return to that existing profile. Do not manually refresh or reopen the profile to force the result.
6. Confirm publication and sentiment/rating tasks in worker logs, observe the pending state without an old number, then confirm the new value/count reaches the existing profile through its five-second observation interval. Allow up to the existing two-minute window. Compare the displayed value with the authenticated detail response and aggregate revision completion.
7. Repeat with approved negative/positive fixture contributions, deletion, and accepted text edits. Verify disabled/missing ratings stay hidden and offline Recent Explore shows no live numeric aggregate. Verify navigation/account change stops obsolete synchronization.

Only approved fixture content should be used. A remote write by a different account alone is not a client-known mutation and does not promise immediate push to an otherwise idle profile.

## Files and remaining risks

New repository files:

- `docs/experimental-business-rating-phase6b-runtime-verification.md`: this report.
- `sugbogo_frontend/mobile/src/features/explore/hooks/__tests__/BusinessRatingRuntime.test.tsx`: opt-in real-HTTP mounted-component integration test.

Local ignored audit artifacts include `.analytics-demo/phase6b/runtime.py`, worker/Beat/API logs, sanitized state/receipts, registration snapshots, and cleanup/integrity proofs. Mobile logs are `.phase6b-mobile-runtime.log`, `.phase6b-mobile-regression.log`, `.phase6b-mobile-lint.log`, and `.phase6b-mobile-opt-in-guard.log`.

The earlier Phase 6 working-tree changes were preserved. No application implementation, formula, five-review minimum, inference/routing, Discovery Score logic, specialty-vouching logic, or screen design was changed. No dependencies were installed and no commit was created.

Remaining limits are physical-device/full-screen acceptance, external moderation-provider availability, other-language scoring quality, production capacity, worker-loss crash redelivery, and the bounded timestamp-based client freshness contract. Experimental legacy provenance and known scoring-quality limitations remain unchanged; public-production readiness requires separate approval and validation.
