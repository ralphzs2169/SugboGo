# Experimental business rating lifecycle (Phase 4)

## Activation and compatibility

Automatic aggregate updates default to enabled through
BUSINESS_RATING_AUTO_UPDATES_ENABLED. Explorer exposure remains separately gated
by EXPERIMENTAL_BUSINESS_RATINGS_ENABLED (default False). Ratings remain
experimental; no numerical methodology has been validated by this change.

New aggregates select BUSINESS_RATING_DEFAULT_SCORING_VERSION, defaulting to
legacy-unverified-v1. This explicitly names unverified existing scores. An
existing aggregate retains its selected version. Recording a future-v2 result
does not silently change a business using future-v1 or legacy inputs. Use the
existing recompute_business_ratings --scoring-version command to deliberately
switch an existing business. Incompatible inputs never contribute together.

Migration 0030 adds aggregate failure attempts, retry deadline, error type and a
versioned-result validity flag. It contains no inference or historical score rewrite.
Apply 0029 and 0030 before deploying workers/web code that uses these columns.
No development database migration is performed by the implementation task.

## Lifecycle and transaction boundary

Publication (including shared automatic/admin publication), accepted changed text,
successful legacy sentiment persistence and administrative rejection record
rating demand inside their source transaction. ORM pre_delete also covers author
deletion, queryset deletion and parent cascades for existing snapshots. It avoids
creating new aggregate rows during a parent cascade. Missing rows are bootstrapped
by periodic reconciliation.

record_result() persists the selected source text/version and records demand in
the same transaction. invalidate_result() revokes a versioned result while keeping
its row as a tombstone: it cannot silently fall back to legacy scores. A later
record_result() explicitly revalidates it. Source-text equality still excludes
old results after edits.

Pending reports, advisory device-abuse flags, sentiment outliers, replies,
community visibility and photo-only edits do not independently change rating
eligibility. Moderation and review insight rules remain unchanged.

Known bulk score/status changes must call
BusinessRatingWorkService.request_changes(business_ids) inside their owning
transaction. It deduplicates IDs and uses stable lock order. Arbitrary direct
QuerySet.update(), raw SQL or external database writes cannot emit Django save
events; periodic reconciliation repairs those paths eventually. Do not rely on
it when an application already knows the affected businesses.

Source mutations acquire review/reputation/business locks in the existing order,
then rating demand, before insight scheduling locks. Aggregate workers acquire
the business and aggregate locks but never lock source review rows. Inference
runs outside these aggregate transactions.

## Delivery and stale results

request_change() increments requested revision durably and dispatches only through
transaction.on_commit. Rollback discards both demand and dispatch. Broker failure
is logged and leaves the revision outstanding.

recalculate_business_rating receives a business ID, not a score snapshot or an old
version. Under the business/aggregate lock it reads the latest selected version
and requested revision, then performs the authoritative one-query count/average.
Completed delivery is a no-op when no revision is outstanding. Direct revision-
fenced recalculation also refuses outdated revisions/versions. A concurrent source
mutation records a later revision after the worker releases its lock.

The API suppresses both numeric value and the previous contributing count while
known demand is pending. Failure backoff is unavailable; ordinary demand is
pending. Successful snapshots retain ready/insufficient_data. Unsupported calculation
versions remain unavailable. computed_at can describe the previous completed
snapshot while value/count are suppressed. automatic_updates_enabled reflects
configuration, not a live health check of worker or Beat processes.
sentiment_aggregate_included retains its original recent-insight meaning.

## Tasks and recovery

- recalculate_business_rating: no inference; late acknowledgments and rejection
  on worker loss; at most three Celery retries per delivery.
- recover_business_ratings: runs every 60 seconds; redispatches up to 100 due
  pending aggregates.
- reconcile_business_ratings: runs every 300 seconds; marks up to 100 missing,
  unsupported-calculation or aged snapshots for recalculation. Completed snapshots
  become eligible after one hour, ordered oldest/missing first.

Failures persist an attempt count, error type and delay (30/60/120/240/300 seconds,
capped at 300). Failure recording is revision-fenced. A database outage may prevent
persisting backoff; bounded Celery retries and later durable recovery remain.
Retry exhaustion does not delete pending demand. Periodic recovery continues
bounded attempts, so persistent failures need operational investigation.

Duplicate deliveries may cost an extra row-lock/read but never incrementally add
contributions. The formula and five-review threshold are unchanged. Aggregate
queries are all-time; there is no 30-day restriction or sampling.

Periodic reconciliation is bounded and eventual, not a fixed freshness SLA.
Large installations can take several batches to sweep, and unresolved work must
be monitored. Workers and Beat must both run. Broker, worker and actual model
health were not validated by unit/integration tests.

## Independent historical inference recovery

Missing or failed classifications do not become neutral. An aggregate can be
current for its available contributors without proving that every published review
has been successfully classified.

Normal insight inference recovery retains its 30-day behavior. For initialized
legacy businesses, an explicit separate command can run existing local inference
on missing all-time, published, nonblank, unversioned reviews:

    python manage.py repair_rating_sentiment --business-id 12 --legacy-unverified

This command is repeatable, reports attempts/updates/failures, and exits nonzero
on remaining inference failures. It runs no inference for already-complete
scores, excludes explicit versioned results, and does not automatically rewrite
invalid non-null historical scores. It is not part of aggregate retry/reconciliation.
Large businesses may require time to finish this operator-invoked repair.

Future versioned inference recovery remains the producer's responsibility. It
must call record_result() only for the exact current text and use a new
compatibility identifier for material methodology changes. Persistent asset or
model failures require correction before another repair attempt.

## Remaining release work

This phase adds no mobile polling/invalidation or UI. Mobile integration must
observe the rating's own state and computed timestamp. Live worker/Beat/broker
smoke testing and production capacity/lock-latency validation remain deployment
checks. Scoring quality and public-rating approval remain separate blockers.

