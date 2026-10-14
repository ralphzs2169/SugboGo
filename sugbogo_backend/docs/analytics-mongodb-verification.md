# Live MongoDB analytics verification

Branch: `chore/analytics-live-mongodb-verification`, based on pending mock-entitlement commit `1a115630`. The verification branch intentionally includes local analytics dependencies even while their GitHub merges are pending. It does not modify Discovery Score, tracking deduplication, analytics definitions, domain models, dependencies, local .env, or application migrations.

## Observed baseline: 14 October 2026

- Initial backend inspection found no configured MONGODB_URI. No implicit localhost test was used as a substitute for an explicit target.
- The user then configured a private Atlas development cluster in their local backend .env.
- The backend successfully loaded an explicit mongodb+srv URI, populated credentials without unreplaced password placeholders, and database name `sugbogo`. No credentials/URI were printed or committed.
- A read-only Atlas ping succeeded after allowing the network operation outside the restricted execution sandbox.
- A read-only collection lookup reported that `discovery_visibility_events` does not exist in `sugbogo`. No collection, events or indexes were created by those baseline checks.
- PyMongo 4.18.0 is installed. A CryptographyDeprecationWarning about certificate serial-number parsing was observed during the successful connection. TLS/certificate validation was not disabled and no package update was made; record it for future driver/dependency compatibility review.

These observations establish configuration/connectivity only. They do not establish event capture, complete history, retention, query scalability or frontend delivery. Reviews, summaries, vouches and current Pocket rows are PostgreSQL domain data in the maintained repository; MongoDB holds recorded discovery visibility events.

## Read-only command

From sugbogo_backend:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py verify_visibility_mongodb --period 30
```

Options:

- `--period 7|30|90|custom`, default 30, using existing Manila reporting boundaries.
- `--start-date YYYY-MM-DD --end-date YYYY-MM-DD` for custom periods.
- `--max-time-ms 15000`, allowed 1000-60000; a client-side total Mongo-operation budget plus per-aggregate server limits.
- `--explain` optionally adds sanitized queryPlanner stage/index names for the current-window match. It does not request executionStats or return raw predicates/documents.

This command validates an explicit URI/database, pings, reads collection existence and existing index definitions, and returns selected-period event counts, whole-period distinct recorded explorers, first-observed dates and metadata. Inspection uses independent read pipelines with the existing normalization rules. It never invokes ensure_indexes, event writers, collection creation or cleanup. It performs no SQL queries for domain identities.

Missing collection yields status collection_missing, null totals/distincts, and an explicit metadata reason. It is not a claim of zero real activity. Existing healthy empty period reads can return zero recorded counts, with coverage still unverified. Driver exception output is restricted to type/code; URIs, hosts, credentials and raw documents are excluded. Warning categories are recorded without printing their raw messages.

The current dedupe index must be named `visibility_event_dedupe_key_unique`, be unique, and have key dedupe_key ascending. The current aggregation index must be named `visibility_event_business_time` with ascending event_type/business_id/occurred_at in that order. Inspection reports mismatches without repairing them. Existing TTL definitions are displayed if present; absence of a TTL index is not proof of indefinite retention or successful backups.

Elapsed read time and planner stages are a diagnostic baseline, not a production load benchmark. The optional planner can be denied by deployment permissions or constraints; that must be reported, not bypassed through broader credentials or silent fallback. First-observed dates cannot certify uninterrupted capture.

## Opt-in live tests: write and cleanup boundary

`apps.business.services.tests.test_visibility_live_mongodb` is disabled unless the test process has `SUGBOGO_LIVE_MONGO_VERIFY=1`. Do not enable this flag in normal application startup or commit it into an environment file. File creation is separate from authorization to execute these tests.

Safeguards:

1. Domain fixtures require a separate PostgreSQL/PostGIS database whose name begins test_ and differs from the application DB_NAME. Django's approved test runner creates/migrates/removes that test database; application domain records are not used.
2. Each live test generates `sg_av_<32 hexadecimal UUID characters>` (38 ASCII bytes, within the Atlas Free database-name limit). There is no external database-name override.
3. Validate the exact prefix/random format, reject the configured application Mongo name, and refuse an already-existing target before writes. Existing database names are inspected internally but not printed.
4. Patch only Mongo database selection, the reporting clock, process-local index/availability state and error logging. The Mongo client, writers, aggregates and server operations are real; the normal `sugbogo` collection is not targeted.
5. Writers create only the existing visibility indexes and synthetic events in the owned temporary namespace. Test SQL IDs/actors are fixtures, not actual explorer identities.
6. Register cleanup after ownership checks. Drop only that exact verified fresh namespace after the test, including assertion failures, and verify it is absent. Never drop the normal application database or a preexisting verification database.
7. Bound Mongo operations and sanitize driver failures. Restore process-local Mongo client/settings/index/availability state after tests. Interrupted processes or network failure can leave a temporary namespace; record its exact name and obtain explicit approval for manual cleanup instead of wildcard deletion.

The Atlas database user must be permitted to operate on the temporary namespaces, including listing authorized database names, creating the indexes/events and dropping the owned database. If the current credentials cannot do that, stop and agree a dedicated test principal/target; do not alter a production user's permissions automatically.

### Test scenarios

| Scenario | Evidence |
|---|---|
| Signed JWT impression/profile POSTs | In-process Django APIClient requests with real token validation and real Atlas writes; duplicate requests retain one event |
| Existing index definitions | Unique dedupe and event/business/time indexes created by the existing write path in the temporary database |
| UTC day vs Manila day/week | Same UTC day deduplicates; crossing UTC midnight can record another event within one Manila day; dateTrunc daily/weekly grouping works on the real server |
| Whole-period distincts | Repeated actors across days, businesses and event types do not become summed uniques; profile-only series retains its event filter |
| Half-open period boundaries | Include start, exclude end, clip weeks and normalize decoded BSON UTC dates; first observation still leaves coverage unverified |
| Pocket callback and retention | Execute queued on_commit callbacks in the disposable SQL test harness; actual SAVE is written; unsave does not erase it; same-UTC-day resave stays deduplicated |
| Empty reads and controlled fault injection | Healthy reads do not create collections. Injected PyMongo failure preserves a SQL Pocket row and raises tracking unavailability; this is not a live Atlas/network outage |

The six opt-in tests do not call providers, create actual user accounts in the application database, test a running HTTP server, or exercise the actual mobile network/visibility hooks. Callback execution within a TestCase is controlled execution, not proof of cross-database durable commit coordination. Those distinctions must stay in the final report.

### Execution commands after separate approval

Offline unit/command verification (no live Atlas access):

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.business.services.tests.test_visibility_mongodb_verification --noinput
```

Live verification creates the disposable SQL database, temporary Mongo namespaces/indexes/events, and drops only those namespaces. Restore the process environment flag even when the runner fails:

```powershell
$previousLiveMongoOptIn = $env:SUGBOGO_LIVE_MONGO_VERIFY
$liveVerificationExitCode = 1
try {
    $env:SUGBOGO_LIVE_MONGO_VERIFY = '1'
    & '..\.venv\Scripts\python.exe' -B manage.py test apps.business.services.tests.test_visibility_live_mongodb --noinput
    $liveVerificationExitCode = $LASTEXITCODE
} finally {
    if ($null -eq $previousLiveMongoOptIn) {
        Remove-Item Env:SUGBOGO_LIVE_MONGO_VERIFY -ErrorAction SilentlyContinue
    } else {
        $env:SUGBOGO_LIVE_MONGO_VERIFY = $previousLiveMongoOptIn
    }
}
if ($liveVerificationExitCode -ne 0) {
    throw "Live Mongo verification failed with exit code $liveVerificationExitCode."
}
```

The target is generated internally; do not add overrides pointing at `sugbogo`. Review full pending SQL migration effects in the test database separately from any request to migrate the application database.

### Recorded execution

- The read-only command passed; the application visibility collection was absent, so its optional planner was not executed and counts remained unavailable.
- The initial combined run passed all nine offline tests but failed all six live tests and their cleanup attempts with MongoDB code 8000. The original temporary database names were 56 bytes, exceeding the [Atlas Free 38-byte database-name limit](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).
- Read-only diagnosis confirmed that the long name was rejected as too long, a shorter namespace could be read, and no databases with the original verification prefix were visible afterward. The application visibility collection remained absent.
- The corrected combined run passed all 15 tests (nine offline and six live) in 12.650 seconds, with exit code 0 and no Django system-check issues. Live checks exercised signed-JWT tracking requests, existing write-path indexes, deduplication, Manila buckets, distinct aggregation, period boundaries, Pocket callbacks, and controlled failure handling; each owned temporary database passed its cleanup check. Django removed the disposable SQL test database.
- The certificate serial-number CryptographyDeprecationWarning remained during the successful run. No TLS settings or dependencies were changed. The PowerShell example preserves the test runner's exit status across environment restoration.

## Remaining verification after these checks

- Real mobile card/profile/Pocket tracking with the deployed frontend; initial hooks use limited retries and no durable offline queue.
- Real server/network outage and recovery, and agreement on observing lost events. Pocket domain commits can outlive a failed SAVE write.
- SQL/Mongo application-data reconciliation and the effect of current statuses/moderation, rather than synthetic fixtures only.
- Retention policy, backup/delete/outage evidence and reliable source watermarks before any temporal growth claim.
- Production-scale aggregates, index plans and full-report/peer cost; propose indexes/caches/rollups only after measurement and approval.
- Latest-main dependency reconciliation, manual JWT/network requests and frontend interpretation of partial/unavailable/insufficient states.

Fresh Atlas connectivity and passing synthetic fixtures do not turn coverage_verified on, backfill missing history, or remove null growth comparisons. No coverage override, deduplication change or Discovery Score modification is part of this task.
