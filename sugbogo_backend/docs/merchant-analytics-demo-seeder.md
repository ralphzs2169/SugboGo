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
- MongoDB insertion is resumable and idempotent. Documents use only the existing
  `event_type`, `business_id`, `explorer_id`, `occurred_at`, and `dedupe_key` fields.
  Dedupe is event type × explorer × business × **UTC day**, while reporting uses
  inclusive Asia/Manila calendar dates through existing analytics services.
- Existing required named indexes are verified. Missing required indexes are
  created only on apply, never during dry run; conflicting indexes are not replaced.
- PostgreSQL and MongoDB do not share a transaction. A failed apply may leave
  verified SQL fixtures and some observations; resume the same signed execution.
  Do not delete the journal or change `SECRET_KEY` to work around a failure.
  Keep the journal and secret key with any backup used for recovery. Filesystem
  durability still depends on the host filesystem; this is not a cross-store outbox.
- Reserved-email collisions, context changes, tampered journals, edited rows, or
  foreign observations using demo accounts are rejected rather than overwritten.

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
relationships, and all visibility observations referencing its reserved accounts.
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

## Advanced scope and manual QA

- Recorded profile-visit timing is populated by the same visibility observations;
  it never represents physical arrivals or recommended opening hours.
- The existing read-only recommendation service may expose actual deterministic
  findings/actions from these records. No generation request or job is created.
- Stored summaries, provider provenance, AI outputs, recommendation generation
  states, peer businesses, and entitlement records are not fabricated. Existing
  peers may still be insufficient; stored insights may remain unavailable.
- Aged unanswered reviews, route-planning intent, and discovery-source reporting
  are excluded. No new events, migrations, analytics policies, or APIs are added.

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
