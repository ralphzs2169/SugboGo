# Merchant Analytics development demo seeder

This command adds synthetic Standard and Core Plus evidence to **one explicitly
selected existing business**. The default is a read-only inventory and plan.
It never selects a business automatically or creates supporting peer businesses.

## Preconditions

- Use an authorized disposable local/development PostgreSQL/PostGIS database
  and development-only MongoDB database. Never use a production copy containing real users.
- `DEBUG=True` and `TIME_ZONE=UTC` are required. PostgreSQL must use loopback;
  remote PostgreSQL hosts and service aliases are rejected. MongoDB defaults to
  loopback but supports explicitly authorized hosted development databases below.
  System database names and names containing a `prod`/`production` token are rejected.
- The selected business must exist, be active, and have an active merchant owner
  and a valid creation date. Existing category, location, owner, and specialties
  are retained. At most three existing active specialties are used; none are added.
- Existing analytics policy and complete discovery reputation configuration must
  be readable. The plan reports policy values and the owner's effective Plus access.
  Entitlements are never activated or changed.
- Stop local Celery workers, Beat, and other writers for apply/cleanup and manual
  demo testing. The confirmation flag is a developer attestation, not process discovery.
  Scheduled moderation, reputation, scoring, or insight jobs could otherwise change
  demo records. The command itself never calls those workflows.
- Local connection checks cannot detect a production database reached through a
  local tunnel. Database-name confirmations explicitly attest that both targets are
  authorized development databases; do not forward production services to loopback.

## PowerShell usage

Run from `sugbogo_backend`. Set these values explicitly after checking your local
settings; the business ID is an existing developer-selected target:

```powershell
$demoBusinessId = 123 # Replace with the intended existing BUSN_ID.
$demoPostgresDatabase = "your_local_development_database"
$demoMongoDatabase = "your_local_development_mongodb_database"

# Read-only: SQL/MongoDB inventory, eligibility, quantities, policy and access.
.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo --business-id $demoBusinessId

# Explicit local-development write authorization, after reviewing the plan.
$env:SUGBOGO_ANALYTICS_DEMO_ALLOW = "local-development"
.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo `
  --business-id $demoBusinessId `
  --apply `
  --confirm-postgres-database $demoPostgresDatabase `
  --confirm-mongodb-database $demoMongoDatabase `
  --confirm-background-workers-stopped
```

Repeat the same apply command to resume or verify the existing dataset. The signed
plan retains its original anchor: reruns never shift historical dates or inflate
counts. To prepare a fresh reporting window later, clean the previous execution
first, then explicitly apply a new plan.

`--dry-run` is an optional explicit alias for the default. `--manifest-directory`
can select a durable private directory instead of `.analytics-demo/`; use that same
directory for every resume and cleanup. Do not share one manifest directory across
different database environments.

### Hosted development MongoDB (including Atlas/SRV)

For a dedicated hosted **development** MongoDB database, add both
`--allow-remote-development-mongodb` and `--confirm-mongodb-database` to every
dry run, apply, resume, and cleanup. The flag explicitly attests that the remote
database is development-only; the command cannot independently establish a hosted
database's operational purpose. PostgreSQL remains local and every existing write
confirmation remains required. The existing `local-development` environment marker
continues to identify the authorized development execution, even with hosted MongoDB.

```powershell
.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo `
  --business-id $demoBusinessId `
  --allow-remote-development-mongodb `
  --confirm-mongodb-database $demoMongoDatabase
```

For apply, add `--allow-remote-development-mongodb` to the earlier apply example.
For cleanup, add it and the MongoDB name confirmation to both cleanup examples.
Single-host `mongodb://` and `mongodb+srv://` seed endpoints are supported; an SRV
URI must not contain an explicit port. Use development-scoped MongoDB credentials.
The manifest binds hosted executions to the configured hostname, URI scheme and
database name without storing credentials or the connection URI.

## Dataset and expected dashboard results

For a business and three active specialty links eligible for the full 90-day
window, the synthetic contribution is:

| Record | Quantity |
| --- | ---: |
| Active explorer accounts with unusable passwords | 48 |
| MongoDB IMPRESSION observations | 460 |
| MongoDB PROFILE_VISIT observations | 165 |
| MongoDB SAVE observations | 30 |
| Current retained Pocket relationships | 14 |
| Published reviews | 30 |
| Eligible replies / unanswered reviews | 19 / 11 |
| Valid retained specialty vouches | 36 |
| Route requests, when the full window is legitimately tracked | 92 (64 Road Route, 28 Jeepney) |

The 30 fixture reviews have 18 positive, 4 neutral, 5 negative, and 3 unclassified
labels. These are explicitly synthetic classifications, not output from a provider.
Reviews contain a `[DEMO ...]` marker and are excluded from the community feed.
They remain ordinary published demo evidence in the target's local review listing.

The 7/30/90-day event contributions are respectively 84/234/460 impressions,
30/85/165 profile visits, and 6/16/30 saves. Current Pocket holders remain 14
regardless of the selected period. The policy determines sentiment sufficiency;
the command does not lower thresholds to force an available result.

Activity has deterministic weekday/hour variation and quiet days, so daily and
weekly visibility charts, weekly saves/reviews/support, sentiment, reply rates,
median reply time, and recorded online profile-visit timing can be inspected.
Existing genuine records add to these values; the command never normalizes the
target's totals to a desired number. Exact distinct visitors/savers/supporters and
the backend's rates come from the existing analytics calculations.

Young businesses and recently created/reactivated specialty links receive fewer
records. No observation precedes the business's creation, and no vouch precedes its
link's creation/activation. No active links means no vouches. Quiet historical
days have no MongoDB observations; no fabricated zero documents are inserted.

The JSON result includes existing inventory, `planned_contribution`, skipped scope,
and the fixed anchor. A completed apply additionally reports `seeded_contribution`,
`verified_sql_records`, and `mongo_inserted_this_run`. A repeated successful apply
reports zero newly inserted MongoDB records. For a fully eligible target, there
are 147 seed-owned SQL records and 655 MongoDB documents in total.
The 655 visibility observations are unchanged. With a full eligible route window,
there are also 92 route observations; the shared initialization document is not
seed-owned. Young businesses and tracking initialized recently receive fewer routes.

## Route planning and discovery sources

`PROFILE_VISIT` observations now carry one approved `discovery_source`. Stable
hash-based weights favor Explore (32%), Search & filtered results (25%), and Map
(20%), with smaller Discovery lists (8%), Similar places (6%), Community (5%), and
Source not recorded (4%) contributions. These are assignment weights, not promised
totals or actual market attribution. Counts vary by date/actor and reporting period.
For plans with at least seven profile observations, a small evenly spread sample
ensures every approved channel (including unknown) is demonstrated. Existing
stored source assignments are retained. Very small datasets may not show every source.
No extra profile visits are created for attribution; existing totals and distinct
visitors remain unchanged. Revisit-specific source categories are never introduced.

An existing signed v1 execution can be extended in place. Before applying changes,
the command journals the extension and verifies the original exact observation
fingerprints and SQL-owned explorer IDs. Only an exact legacy seed-owned profile
visit missing the source field can be enriched. An existing attributed visit,
edited observation, genuine event, or unverifiable actor is not reattributed.
Runtime first-source-wins ingestion is unchanged. Dry runs do not enrich records.

For an already completed v1 seed, an upgrade preserves the original signed plan,
SQL row IDs/fingerprints, visibility document IDs/timestamps, and all prior
record counts. Legitimate sentiment processing may already have changed review
classifications and dependent analytics; the upgrade preserves those current values.
The first upgrade enriches only verifiable seed-owned
unattributed visits and inserts missing route observations. Second and later runs
insert no visibility observations and no duplicate routes; existing source values
are preserved. Cleanup uses the same signed manifest for both old and new records.

Completed visibility datasets are explicitly protected against regeneration. If
an expected impression, visit, or SAVE is missing or edited, the command stops and
reports the issue. A missing/untrusted manifest is not reconstructed from email
patterns or event resemblance. Preserve the journal and investigate; do not delete
it to force a rerun. Genuinely interrupted first-time seeds retain their original
resume behavior and may insert their still-missing planned observations.

### Completed datasets: MongoDB-only extensions and SQL drift

Initial creation and incomplete SQL recovery still require exact fingerprints for
every owned SQL row. After a signed execution reaches `phase: complete`, the same
command automatically selects `execution_mode: mongodb_extension`. No additional
flag is required. This path never creates, updates, or deletes SQL records.

Sentiment reconciliation can legitimately classify originally unclassified demo
reviews and update their timestamps after seeding. Full-row fingerprints then
differ even though the review identities remain intact. Completed extensions
report these rows in `sql_drift` (model, ID, and fixture key) and preserve them.
The original signed `rows` fingerprints and base `plan` are never replaced.

The extension still requires the complete signed fixture inventory: every original
row must exist, each model/key/ID must be unique and correct, and business/account,
review-reply, specialty, and original creation-time bindings must match the plan.
Every synthetic Explorer account must retain its exact signed full-row fingerprint.
Target ownership, specialty context, environment identity, signature, and exact
MongoDB observation checks remain mandatory. Missing, rebound, or untrusted records
are rejected. This relaxation applies only to mutable non-account SQL content in
completed MongoDB extensions, not initial seeding, incomplete recovery, or cleanup.

`reporting_extension.phase` tracks extension progress independently:

- `planned`: a new or legacy pending extension has not completed under this lifecycle.
- `applying`: MongoDB writes may be partially applied; rerun the same command.
- `complete`: both visibility enrichment and the signed route plan succeeded.
- `awaiting_initialization`: visibility processing succeeded, but no eligible route
  plan exists yet; initialize tracking separately and rerun.

The base `phase` remains `complete` throughout a completed-dataset extension.
Older interrupted extensions with `phase: mongo_writing` and a signed
`preserve_existing_visibility: true` are recognized as completed-base recovery.
Initial interrupted MongoDB writes with that flag false remain strict SQL recovery.
An existing route plan, its anchor, and tracking start are retained, including plans
saved before an earlier SQL-drift refusal. Dry runs report the proposed status
without writing the manifest, indexes, or either database. Reruns verify existing
observations and insert only missing planned routes; visibility counts cannot grow.

Cleanup deliberately remains stricter: it rejects any changed SQL fingerprint or
unowned dependent relationship before deleting records. Successful MongoDB extension
does not authorize later deletion of sentiment-enriched or otherwise modified rows.
Do not delete/re-sign the manifest or restore sentiment values just to force cleanup.

For the existing Business 9 development execution, review the read-only output:

```powershell
.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo `
  --business-id 9 `
  --allow-remote-development-mongodb `
  --confirm-mongodb-database sugbogo
```

After reviewing it and actually stopping background writers, apply to the same
authorized development databases:

```powershell
$env:SUGBOGO_ANALYTICS_DEMO_ALLOW = "local-development"
.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo `
  --business-id 9 `
  --allow-remote-development-mongodb `
  --apply `
  --confirm-postgres-database sugbogo_db `
  --confirm-mongodb-database sugbogo `
  --confirm-background-workers-stopped
```

Expect `mongodb_extension`, explicit SQL drift, zero visibility inserts, the existing
pending route plan, and `extension_phase: complete` only after successful MongoDB
operations. Repeating apply should report zero source updates and zero route inserts.
These commands must not be run against production or shared non-demo environments.

Regression tests simulate the pre-extension signed manifest/document format,
upgrade it without allowing base-dataset or SQL regeneration, run it two more
times, compare fixed-window 7/30/90-day reports and complete SQL fingerprints,
verify source parity, then clean only the owned records. Missing-manifest and
missing-completed-observation cases verify that refusal leaves records unchanged.

Route tracking must be initialized separately in the explicitly authorized
development database. After checking the configured database and before seeding:

```powershell
.\.venv\Scripts\python.exe -B manage.py initialize_route_planning_tracking
```

This setup command creates/verifies the route indexes and initializes
`tracking-state-v1` without observations. It preserves an existing `started_at`.
It uses the configured MongoDB connection; it does not accept the demo seeder's
remote-confirmation flags. Run it only after verifying the development target.
The seeder itself never initializes, resets, or backdates tracking metadata.

The existing seed command and flags remain unchanged. If tracking is missing or
invalid, visibility and relational demo data can still be seeded, while routes are
skipped with an explicit inventory limitation. Initialize tracking and rerun the
same authorized apply to add routes without rebuilding the original dataset.

Routes use the existing Road Route/Jeepney schema, reserved demo explorers, and
account × business × method × UTC-day identity. Some accounts deliberately use both
methods on the same day. Distinct accounts are deduplicated across methods by the
existing analytics service, not by summing method totals. No API tracking workflows,
notifications, external routing calls, AI generation, or Celery jobs are invoked.

The route extension has its own signed, fixed anchor when first planned with valid
initialization. It is independent of the older visibility plan's anchor. Observations
fall after the later of business creation and the real tracking start, within the
last 90 Manila calendar days and before that anchor. A just-initialized database may
receive only two observations (one per method, the same account) within its short
valid interval. No pre-initialization history or coverage is invented. Timestamps use
BSON millisecond precision so exact ownership checks survive MongoDB round trips.

Consequently, 7/30/90 route totals may be identical after recent initialization.
The report remains partial with unverified delivery coverage. A reporting period
entirely before tracking remains unavailable, rather than a fabricated zero.
Seeding never makes growth comparisons eligible. For a full eligible 90-day route
window, expected contributions are 20/46/92 requests for 7/30/90 days; genuine
activity adds to these numbers. The command reports exact planned/seeded route
totals, distinct fixture actors, methods, tracking start, and route-plan anchor.

Reruns preserve both anchors. Route insertions report
`route_mongo_inserted_this_run`; existing visibility insertions retain
`mongo_inserted_this_run`; legacy enrichment reports
`profile_sources_updated_this_run`. A completed repeat inserts and updates zero.

## Persistence and recovery

- Namespace: `merchant-analytics-b<BUSN_ID>-v1`; emails end in `@sugbogo.invalid`.
- A business-scoped PostgreSQL advisory lock serializes command invocations.
- Every new relational row is validated and created inside one SQL transaction.
  Only newly created fixture timestamps are backdated; existing timestamps are
  never changed. Raw model writes bypass application mutation workflows.
- The signed local manifest journals the plan, database identity, original
  eligibility context, row IDs and complete-field fingerprints before SQL commit.
  Atomic file replacement and file fsync protect process-interruption recovery.
- An interrupted SQL commit is resolved by checking whether all or none of its
  exact rows exist. A partial or edited set requires manual investigation.
- MongoDB insertion is resumable and idempotent. Visibility documents use the existing
  `event_type`, `business_id`, `explorer_id`, `occurred_at`, and `dedupe_key` fields,
  with `discovery_source` on profile visits. Route documents use `business_id`,
  `explorer_id`, `navigation_method`, `utc_day`, and `occurred_at`.
  Dedupe is event type × explorer × business × **UTC day**, while reporting uses
  inclusive Asia/Manila calendar dates through existing analytics services.
- Existing required named indexes are verified. Missing required indexes are
  created only on apply, never during dry run; conflicting indexes are not replaced.
- PostgreSQL and MongoDB do not share a transaction. A failed apply may leave
  verified SQL fixtures and some observations; resume the same signed execution.
  Do not delete the journal or change `SECRET_KEY` to work around a failure.
  Keep the journal and secret key with any backup used for recovery. Filesystem
  durability still depends on the host filesystem; this is not a cross-store outbox.
- Reserved-email collisions, context changes, tampered journals, edited accounts,
  or foreign observations using demo accounts are rejected rather than overwritten.
  Other SQL edits remain strict failures during initial recovery and cleanup;
  completed MongoDB extensions report content drift while preserving those rows.

Cached business and specialty counters, discovery scores, and reputation are left
unchanged. Analytics reads the underlying eligible records. Cached counts on other
development screens can consequently differ during the demo; this command is for
Merchant Analytics QA and does not rebuild broader discovery state.

## Scoped cleanup

First preview, then confirm the same business and both database names:

```powershell
.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo `
  --business-id $demoBusinessId --cleanup

.\.venv\Scripts\python.exe -B manage.py seed_merchant_analytics_demo `
  --business-id $demoBusinessId `
  --cleanup --apply --confirm-cleanup $demoBusinessId `
  --confirm-postgres-database $demoPostgresDatabase `
  --confirm-mongodb-database $demoMongoDatabase `
  --confirm-background-workers-stopped
```

Cleanup requires the signed manifest. It verifies SQL fingerprints, dependent
relationships, and visibility/route observations referencing its reserved accounts.
If a merchant adds a real reply, a demo account gains unrelated relationships, or
a fixture is edited, cleanup refuses rather than cascading into foreign data.
Resolve such changes through a separate reviewed local repair; do not force-delete
rows or bypass the ownership checks.

Exact manifest-owned observations are deleted first. Verified SQL rows are then
deleted transactionally in dependency order. Shared indexes, collections, taxonomy,
businesses, business links, owners, counters, and genuine observations are retained.
Interrupted cleanup is rerunnable, including interruption after SQL deletion.
Successful cleanup archives a signed `.cleaned-...json` receipt. A subsequent cleanup
without an active manifest reports `nothing_to_clean`.
Route observations are removed before visibility observations and SQL rows. Cleanup
preserves route initialization metadata, its original timestamp, indexes, and all
genuine routes. It can resume after partial deletion or attribution; an old signed
manifest can also be cleaned without first applying this extension. Route deletion
counts are reported separately as `route_mongo_deleted_this_run`.

### Verify both reports

Use the selected business's merchant account and a development access token against
your running local API. These requests are read-only; never print or commit tokens:

```powershell
$demoApiBase = "http://127.0.0.1:8000"
$demoHeaders = @{ Authorization = "Bearer <DEV_MERCHANT_ACCESS_TOKEN>" }
Invoke-RestMethod -Headers $demoHeaders -Uri "$demoApiBase/api/merchant/analytics/standard/discovery-sources/?period=30"
Invoke-RestMethod -Headers $demoHeaders -Uri "$demoApiBase/api/merchant/analytics/standard/route-planning/?period=30"
```

Repeat with `period=7` and `period=90`. Discovery source counts must sum to that
response's profile visits (including genuine unknown-source observations). Compare
with Standard profile visits from the same reporting window; separate live requests
can differ if new activity arrives between their reporting cutoffs. Route methods
must sum to requests; distinct accounts must not be added across methods. Expect
partial coverage after recent initialization. In mobile Analytics, test the independent
Route-planning period selector and the Standard **Where visits came from** detail.

## Advanced scope and manual QA

- Recorded profile-visit timing is populated by the same visibility observations;
  it never represents physical arrivals or recommended opening hours.
- The existing read-only recommendation service may expose actual deterministic
  findings/actions from these records. No generation request or job is created.
- Stored summaries, provider provenance, AI outputs, recommendation generation
  states, peer businesses, and entitlement records are not fabricated. Existing
  peers may still be insufficient; stored insights may remain unavailable.
- Existing review fixtures can appear in the current unanswered-review backlog.
  No separate backlog history is generated. Route planning and discovery sources
  use only existing contracts; no migrations, policies, or APIs are added.

After manual apply, open Analytics on the selected merchant account. Check 7/30/90
periods, daily/weekly visibility, saves versus current holders, specialty selection,
sentiment and reply denominators, timing labels, and pull-to-refresh on Android.
Use the local MongoDB tools to verify the configured collection/indexes and exact
observations, then preview and apply cleanup. Live MongoDB, API/mobile/device, and
filesystem-crash testing are separate from the isolated automated suite.

Run the focused tests with:

```powershell
.\.venv\Scripts\python.exe -B manage.py test apps.merchant_operations.merchant_analytics.services.tests.test_merchant_analytics_demo_seed_service --noinput
```

The test runner uses its isolated PostgreSQL test database and an in-memory
MongoDB test double; it never executes this command against the configured
application database.
