# Phase 6 — Experimental business rating verification

Audit date: 2026-10-30, Asia/Manila.

## Environment status

| Prerequisite | Observed result |
| --- | --- |
| Backend runtime | Existing `.venv`, Python 3.12.10, Django 6.0.6; Django test system checks passed. |
| PostgreSQL | PostgreSQL 18.4 at localhost:5432, database `sugbogo_db`, PostGIS backend; authenticated connection succeeded. |
| Migrations | Reviews `0029_business_rating_foundation` and `0030_business_rating_recovery` applied. MigrationExecutor reported zero pending migrations across the configured project. |
| Redis | Configured broker `redis://127.0.0.1:6379/0`; PING succeeded. Credentials were not included in output. |
| Exposure | `EXPERIMENTAL_BUSINESS_RATINGS_ENABLED=True`. |
| Automatic updates | `BUSINESS_RATING_AUTO_UPDATES_ENABLED=True`. This is configuration, not a worker-health signal. |
| Default scoring | `legacy-unverified-v1`; calculation `signed-average-v1`. All 15 existing aggregates select the legacy version. |
| Worker | `celery@Ralphskie` responded to inspect/ping; solo pool, concurrency 1, prefetch 16. Its registered tasks include sentiment processing but **none of the rating recalculation/recovery/reconciliation tasks**. The running worker cannot execute the new rating tasks. |
| Beat | Source configuration schedules rating recovery every 60 seconds and reconciliation every 300 seconds. Actual execution is unverified. Local schedule files were last modified October 23; this does not prove whether another Beat instance/schedule file exists. Process-command-line inspection was denied by the environment. |
| Management commands | Both rating commands load and their `--help` succeeds. Execution is covered with isolated test fixtures. Neither command was run against development reviews. |
| Backend HTTP | Both localhost:8000 and 172.20.10.2:8000 returned the expected unauthenticated 401 from `/api/explorer/explore/businesses/1/`. Authenticated serialization was tested with Django APIClient, not a real-user HTTP session. |
| Mobile | Node 24.15.0, Expo 57.0.7, React Query 5.101.4. `.env` targets `http://172.20.10.2:8000/api`, reachable from this host. Physical-device LAN access remains unverified. |
| Model assets | Both configured local model paths exist. Synthetic English and Tagalog inputs completed through the existing router, returning finite positive scores through VADER and the configured Tagalog model respectively. This verifies loading/inference availability only. |

No development migrations, fixtures, review edits, aggregate recalculations, worker restarts, or Beat startups were performed. Test database migrations ran only in separately created test databases. The test runner isolates Celery with an in-memory broker and blocks external AI providers.

## Rating data verification

A read-only, repeatable-read transaction compared every completed stored aggregate with its selected version's eligible SQL count/average:

- 15 businesses, 15 aggregates: four `ready`, eleven `insufficient_data`.
- Zero outstanding rating revisions and zero recorded rating errors at inspection time.
- All 15 completed aggregates matched their selected inputs, counts, and ten-decimal stored values.
- 52 published nonblank reviews; two lack complete legacy sentiment. Both are older than 30 days, one each for business IDs 4 and 5.
- No explicit versioned result rows currently exist in the development database; version compatibility was exercised in isolated PostgreSQL tests.

Tests confirm published/nonblank eligibility, recognized labels, finite signed scores within [-1, 1], exclusion of NULL/NaN/infinities/out-of-range inputs, all-time membership, five-review transitions, advisory-flag inclusion, and database aggregate constraints. The unchanged formula is `3 + 2 * AVG(score)`; only the final aggregate is quantized, with API rounding half-up to one decimal.

Explicit versioned results never fall back into the legacy lane, including invalidated or stale-text results. Selecting one scoring version excludes every other version. Legacy rows retain `legacy_unverified` provenance; a `versioned` declaration is not proof of model validation. Existing aggregates retain their selected scoring version when the default or another producer's version changes.

## End-to-end results

| Scenario | Evidence and boundary |
| --- | --- |
| Moderation → publication → sentiment → rating → Explorer | New integration regression uses held fixtures with initial moderation metadata, the moderation task body, actual publication commit callbacks, actual sentiment/rating task bodies, and the existing authenticated Explorer detail endpoint. Moderation and sentiment outputs are controlled; broker delivery is intercepted locally. |
| Positive/negative contributions | Five starting scores of 0.75 yield 4.5. Adding +1 yields six contributors and API value 4.6; adding -1 yields seven contributors and 4.1. Legacy scoring/provenance are asserted. |
| Accepted text edit | Withdraws old sentiment, marks rating pending, and crosses the threshold to four contributors until rescored. Versioned edits/reversions require a fresh result. |
| Failed/rejected edit | Provider timeout and moderation rejection preserve the existing review, score, and ready rating. The provider-timeout regression also checks that no rating revision is requested. |
| Author/ORM deletion and administrative rejection | Remove membership, persist demand, and cross below the five-review threshold. Parent-cascade behavior is covered. |
| Duplicate deliveries | Completed demand is an unchanged no-op; concurrent deliveries acknowledge once without adding contributions. |
| Concurrent source changes | Independent PostgreSQL connections verify that mutations blocked behind an aggregate leave a later revision outstanding. Inference races cover newer edits, deletion, rejection, and competing score persistence. |
| Retry/recovery | Broker failures retain demand; rollback discards demand/callbacks; stale failures and recalculations cannot acknowledge newer revisions; retry exhaustion retains recoverable demand; reconciliation repairs bypassed changes. |
| Mobile presentation/cache | Controlled React Native tests cover ready/hidden/non-numeric states, card variants, mutation invalidation, cached receipt guards, offline Recent Explore, and account/navigation lifecycle behavior. No physical-device session was exercised. |

The complete real Redis/worker/Beat/device chain remains **unverified**. The currently registered worker tasks are a concrete blocker to that live smoke test. No real-user publication was attempted.

## Backend findings

No calculation, lifecycle, concurrency, or durable-recovery defect was reproduced in the focused backend tests. The stored database audit found no aggregate drift.

- Publication and sentiment completion intentionally create separate rating demands. Each recomputes from current inputs; duplicate delivery cannot double-count. Dispatch remains a hint, with durable revisions providing recovery.
- Source mutations record rating demand transactionally, with commit-only dispatch. Deletion signals cover ORM deletion. Arbitrary SQL/QuerySet bulk changes need explicit demand or eventual reconciliation.
- Calculation uses one SQL count/average snapshot. Explorer list/detail querysets eager-load `business_rating`; the focused serializer test asserts one query for the rating queryset. No rating-specific N+1 or inference-on-read path was found. This is not a capacity benchmark of every Explorer endpoint.
- Each rating delivery has at most three Celery retries. Durable recovery can continue indefinitely, with persisted backoff capped at 300 seconds; permanent failures still require operational attention.
- Reconciliation processes at most 100 businesses per run and revisits completed snapshots after one hour. This is eventual repair, without a strict freshness SLA.
- The two historical missing classifications are a confirmed coverage gap. Aggregate recovery does not perform inference, and ordinary sentiment reconciliation uses a 30-day population. All-time legacy repair is a separate explicit operation.

## Mobile findings and fix

Confirmed defect: when the first detail response had rating state `unavailable`, `ReviewDerivedDataSyncProvider` did not start a rating observation. A successful server retry could therefore remain unseen on the mounted profile until another read/focus/reconnect.

The fix extends the existing passive observation trigger to both `pending` and `unavailable` when automatic updates are enabled. It uses the existing shared detail query, five-second interval, two-minute budget, owner/session guards, and polling-owner coordination. It adds no per-card request or background timer.

Regression coverage verifies recovery from initially unavailable data, immediate stop after passive completion, timeout, navigation blur, account change, offline state, unmount, and disabled/manual-only snapshots. Before the fix, the new recovery test failed with one detail call instead of two; it passes after the fix.

Existing safeguards remain verified:

- Missing/disabled rating payloads render nothing. Ready numeric values require a valid timestamp, value, and at least five scored contributors.
- Pending/unavailable/insufficient states suppress numeric values, including older cached receipts following a local mutation.
- Detail completion invalidates existing card collections. Shared cards subscribe to observation state without fetching. Homepage persistence validates the optional rating DTO; Recent Explore explicitly removes it even during reconnect.
- Publication/text-edit/deletion paths invalidate detail and the existing card collection prefixes. Photo-only and failed edits do not invalidate the rating. Observation receipts prevent repeated completion invalidations for the same timestamp.
- Rating polling stops when its observer loses authority/focus or unmounts. The pre-existing sentiment completion grace period can continue for up to 45 seconds after unmount, subject to session, cache, online, and query-error guards; narrative continuation is cleared. That is separate from the rating's two-minute timer.

Timestamp observations cannot prove completion of a particular server revision. A newer timestamp can describe publication before later sentiment completion; local mutation observations therefore retain their existing bounded watch window. There is no server push or indefinite rating polling: work exceeding that window, and changes made by other accounts outside an observed window, require a later authoritative read/focus/reconnect/manual refresh. A permanently mounted idle card collection has no independent freshness guarantee.

## Files changed

| File | Reason |
| --- | --- |
| `sugbogo_frontend/mobile/src/features/explore/hooks/ReviewDerivedDataSyncProvider.tsx` | Minimal condition change to observe initial unavailable ratings. |
| `sugbogo_frontend/mobile/src/features/explore/hooks/__tests__/BusinessRatingSync.test.tsx` | Recovery, stop conditions, and manual-only regression coverage; focus can be controlled in tests. |
| `sugbogo_backend/apps/reviews/services/tests/test_business_rating_lifecycle.py` | Combined moderation/task/API regression and provider-failed-edit preservation assertions. |
| `sugbogo_backend/docs/experimental-business-rating-phase6-verification.md` | This reproducible audit report and operational commands. |

No dependency, model, language-routing, formula, threshold, Discovery Score, specialty-vouching, or screen-design changes. No commit created. The working tree was clean at initial inspection; subsequent changes were confined to the files above.

## Test results and reproduction

| Run | Result |
| --- | --- |
| Initial focused backend selection below | 75 passed, zero failures; PostgreSQL concurrency included. |
| Added moderation/task/API chain alone | 1 passed. |
| Final lifecycle module, including failed-edit extension and new chain | 20 passed, zero failures. There are **76 distinct backend tests** across these runs; reruns are not added to that total. |
| Initial five mobile rating/synchronization files | 45 passed. |
| Final same five mobile files with regressions | 52 passed, zero failures. |
| Final rating-sync file after restoring the existing test's original timer style | 15 passed, zero failures; included in the 52-test selection above. |
| Recent Explore, homepage persistence, review-cache files | 42 passed, zero failures. **94 distinct mobile tests** passed across the final relevant selections. |
| Focused ESLint | Exit 0, no warnings/errors for both changed mobile files. |
| `git diff --check` | Passed; Git reports its normal LF-to-CRLF checkout warnings. |

All test databases used the `test_sugbogo_phase6_<random>` prefix and were destroyed by the runner. A database inventory check after the final run confirmed none remained. Neither full project suite was run.

Backend baseline command, from `C:\Users\Angela\Desktop\SugboGo\SugboGo\sugbogo_backend` (now also includes the added test):

```powershell
@'
import os
import uuid

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.conf import settings
from django.core.management import call_command

settings.DATABASES["default"]["TEST"]["NAME"] = (
    "test_sugbogo_phase6_" + uuid.uuid4().hex[:8]
)
call_command(
    "test",
    "apps.reviews.services.tests.test_business_rating_service",
    "apps.reviews.services.tests.test_business_rating_lifecycle",
    "apps.reviews.services.tests.test_review_sentiment_service",
    "apps.reviews.services.tests.test_review_sentiment_task",
    "apps.reviews.services.tests.test_review_sentiment_concurrency",
    "apps.reviews.views.tests.test_sentiment_completion_views",
    "core.tests.test_celery",
    verbosity=2,
    interactive=False,
)
'@ | .\.venv\Scripts\python.exe -u -
```

For the final 20-test lifecycle run, the same isolated-database wrapper selected only `apps.reviews.services.tests.test_business_rating_lifecycle`.

Mobile commands, from `C:\Users\Angela\Desktop\SugboGo\SugboGo\sugbogo_frontend\mobile`:

```powershell
npm.cmd test -- --runInBand --watch=false --runTestsByPath src/features/explore/__tests__/businessRating.test.tsx src/features/explore/hooks/__tests__/BusinessRatingSync.test.tsx src/features/explore/hooks/__tests__/ReviewDerivedDataSyncProvider.test.ts src/features/explore/hooks/__tests__/ReviewDerivedDataSyncLifecycle.test.tsx src/features/explore/hooks/__tests__/useExploreBusinessProfilePersistence.test.tsx
npm.cmd test -- --runInBand --watch=false --runTestsByPath src/features/explore/screens/__tests__/RecentExplore.test.tsx src/features/explore/persistence/__tests__/exploreHomepagePersistence.test.tsx src/features/explore/utils/__tests__/reviewCache.test.ts
.\node_modules\.bin\eslint.cmd src/features/explore/hooks/ReviewDerivedDataSyncProvider.tsx src/features/explore/hooks/__tests__/BusinessRatingSync.test.tsx
```

Local evidence logs are `.phase6-backend-baseline.log`, `.phase6-backend-integration.log`, `.phase6-backend-lifecycle-final.log`, `.phase6-data-audit.log`, and `.phase6-runtime-audit.log` in the backend, plus `.phase6-mobile-baseline.log`, `.phase6-mobile-final.log`, `.phase6-mobile-rating-final.log`, `.phase6-mobile-offline.log`, `.phase6-mobile-regression-before.log`, `.phase6-mobile-regression-after.log`, and `.phase6-mobile-lint.log` in mobile. The intermediate after-fix run exposed a test timer-flush ordering issue; the new regression now uses asynchronous timer advancement and is green.

## Operational commands and remaining risks

These are instructions for the operator, **not actions performed by this audit**. Restarting workers or running Beat may process queued development work. Use the approved fixture environment for the live smoke test and retain exactly one Beat scheduler.

From the backend directory, stop the existing worker through its owning console, then start the current code in a separate console:

```powershell
.\.venv\Scripts\python.exe -m celery -A config worker --pool=solo --concurrency=1 --loglevel=info
.\.venv\Scripts\python.exe -m celery -A config inspect registered --timeout=5
.\.venv\Scripts\python.exe -m celery -A config inspect ping --timeout=5
```

Verify registration of `apps.reviews.tasks.recalculate_business_rating`, `apps.reviews.tasks.recover_business_ratings`, and `apps.reviews.tasks.reconcile_business_ratings` before publishing a fixture. Confirm whether Beat already exists through its owning console; if necessary, start one scheduler in another console:

```powershell
.\.venv\Scripts\python.exe -m celery -A config beat --loglevel=info --schedule "$env:TEMP\sugbogo-rating-beat"
```

Read-only migration/command checks (no migration application is required in the inspected database):

```powershell
.\.venv\Scripts\python.exe manage.py showmigrations reviews
.\.venv\Scripts\python.exe manage.py recompute_business_ratings --help
.\.venv\Scripts\python.exe manage.py repair_rating_sentiment --help
```

Optional data-changing commands are restricted to an explicitly approved fixture business. Set `$fixtureBusinessId` to that fixture's actual integer ID before use; these were not run on businesses 4 or 5 or any other development review:

```powershell
.\.venv\Scripts\python.exe manage.py recompute_business_ratings --legacy-unverified --business-id $fixtureBusinessId
.\.venv\Scripts\python.exe manage.py repair_rating_sentiment --legacy-unverified --business-id $fixtureBusinessId
```

After worker/Beat readiness, the remaining smoke test is an approved fixture publication through authenticated HTTP, observed worker completion/recovery, and a running mobile profile/card update using the configured API address. External moderation availability, worker-loss redelivery with Redis, Beat execution, physical-device navigation/accessibility, and production throughput/lock latency remain unverified.

Model quality remains a separate release concern. Existing source documents uncalibrated cross-model scores and a known Tagalog polarity error; Cebuano/mixed-language quality was not evaluated. No model or routing changes were made. A replacement producer must choose a new compatibility identifier for material methodology changes, persist exact source-text/version results, and deliberately select/rescore compatible business populations.

## Final verdict

**CONDITIONALLY READY for development.** The focused application tests and stored-data checks pass after the mobile recovery fix. Live end-to-end verification is blocked until the worker loads the rating tasks and Beat execution is established.

**Not ready for public production.** This audit does not approve sentiment quality, historical completeness, release exposure, live delivery behavior, or production capacity.
