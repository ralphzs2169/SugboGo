# Gemini sentiment cutover

Production now uses [global Gemini authority](global-gemini-sentiment.md).
The pilot allowlist and legacy rollback instructions below apply only when
global authority is explicitly disabled in a historical development environment.
Use the global runbook for production preparation, activation and pause.

This branch adds an explicit, reversible authority switch per business. It does not activate Gemini through a migration or environment change alone. Existing businesses stay on legacy sentiment with optional shadow observations until an operator activates a prepared cohort.

## Behavior

- Content moderation and publication remain separate from sentiment classification. A Gemini outage does not reject a published review.
- Before activation, VADER/RoBERTa retain authority; opted-in shadow observations remain isolated.
- Activation requires a compatible ready Gemini observation for every published nonblank comment in the business, including historical comments outside the 30-day summary window.
- Activation atomically pins the model/contract, snapshots prior legacy caches and versioned inputs, projects the whole cohort into existing sentiment fields, and recomputes the business rating and rolling sentiment summary.
- After activation, legacy tasks route to Gemini and recheck authority before saving any in-flight legacy inference. Existing merchant/admin analytics, sentiment filters, serializers, summaries, and outlier baselines read the Gemini projection through their established fields.
- Eligible comments have an anchored signed score. Factual/uncertain comments remain published with a versioned exclusion record, a null score, and no label in the analytics projection. They contribute neither stars nor neutral sentiment counts; they still count as published reviews.
- Stars use `3 + 2 × average eligible score`. The existing minimum of five contributing comments is preserved; fewer than five yields no displayed rating. This is a proposed conversion, not a validated interval measurement.
- Edits clear caches and invalidate rating inputs through the existing lifecycle. Current ready observations can be reused for exact matching text. Deletions cascade through observations, snapshots, and versioned inputs.
- Provider failures retain bounded retry state with no fabricated score or legacy fallback. Projection failures leave ready observations unpromoted for recovery.
- Recovery also repairs missed publication/edit demand for already activated businesses. It does not automatically backfill businesses still in shadow mode.
- An active model is pinned in the database. Changing the environment model or allowlist does not silently change an active business's methodology.

## Deployment and preparation

Merge/deploy the shadow implementation before this branch, or include its commits. Apply migrations before starting the new code. Keep the old release available for rollback after the data rollback described below.

From the repository root:

```powershell
cd sugbogo_backend
& "..\.venv\Scripts\python.exe" manage.py migrate reviews 0033
```

Review the migration plan first when other apps have pending migrations. New migrations are `0032_gemini_sentiment_cutover` and `0033_gemini_rating_eligibility_constraint`. They create policies/snapshots, add explicit rating eligibility with nullable excluded scores, and track projection completion. They do not call Gemini, backfill reviews, or activate businesses.

Keep shadow enablement, the explicit business allowlist, Gemini credentials, the dedicated `gemini_sentiment_shadow` worker, and recovery scheduling configured as documented in the shadow transition guide. Use the existing rating worker/recovery configuration for aggregate updates. No public configuration endpoint is added.

Inspect readiness without provider calls or changes:

```powershell
& "..\.venv\Scripts\python.exe" manage.py prepare_sentiment_cutover --business-id 11
```

Explicitly request up to 100 missing observations for that business:

```powershell
& "..\.venv\Scripts\python.exe" manage.py prepare_sentiment_cutover --business-id 11 --queue --limit 100
```

Repeat bounded batches as needed. Pending jobs are handled by workers/recovery. This command does not reset exhausted or malformed jobs. Investigate those failures and repair their cause before activation. Preparation reports the entire nonblank published cohort; activation revalidates it under transaction locks.

## Activation

1. Obtain a database backup and finish deploying migrations/code to all backend and worker processes. Do not leave old legacy workers running during activation: old releases do not understand persisted authority.
2. Set `GEMINI_SENTIMENT_CUTOVER_ENABLED=True` in the server/worker environment and restart those processes. Keep the target business explicitly allowlisted. This alone does not change authority.
3. Confirm readiness has zero `not_ready` comments, then run during a quiet period:

```powershell
& "..\.venv\Scripts\python.exe" manage.py set_sentiment_pipeline --business-id 11 --mode gemini
```

Incomplete, stale, malformed, or incompatible cohorts abort the whole transaction. Concurrent lifecycle mutations can cause transaction contention; retry an aborted command after those operations finish. An already active compatible business is a no-op. A contract change requires a separately planned reanalysis; this command does not silently upgrade an active version.

Verify user submission, approval, editing, rejection, and deletion in the emulator/admin app. Check eligibility, source/version matches, merchant/admin counts, aggregate freshness, factual exclusions, provider failure/recovery, and the five-contributor threshold. Expand only after this acceptance check passes.

Turning `GEMINI_SENTIMENT_CUTOVER_ENABLED=False` pauses active Gemini inference; it does not restore legacy authority. Existing ready work can still be projected by an already running callback, so stop workers as well if an immediate operational pause is required. Stored authoritative results remain readable. No automatic provider fallback is introduced.

## Rollback

Use the data rollback before restarting a release that lacks cutover awareness:

```powershell
& "..\.venv\Scripts\python.exe" manage.py set_sentiment_pipeline --business-id 11 --mode legacy
```

The command atomically restores prior caches and versioned inputs for unchanged text, restores the previous rating version, recomputes totals, and returns authority to legacy. Edited or newly submitted comments whose legacy classification is unavailable have their caches cleared and are queued for legacy inference. No score from old text is restored to edited text. Snapshots are then removed; shadow observations remain available for evaluation. Deleting a review does not resurrect it on rollback.

Do not reverse the schema migrations merely to switch models. Keep the new columns/tables while returning to legacy. Pending old Gemini jobs may finish as isolated shadow work after rollback, but cannot overwrite authoritative caches.

## Verification

Tests must use a disposable database and an isolated in-memory broker, not the running pilot broker. Disable shadow inference globally for the test run; individual test classes explicitly override gates/cohorts. No real provider calls are made.

From `sugbogo_backend`, the bundled runner sets those overrides in its own process and runs the focused suites and consistency checks:

```powershell
& "..\.venv\Scripts\python.exe" scripts/test_sentiment_cutover.py
```

The local regression run on 2026-11-03 passed **116 tests**, including PostgreSQL concurrency tests inherited from the shadow suite. Django checks and migration consistency passed. Migrations were exercised in the disposable test database; they have not been applied to the real pilot database as part of this implementation. Failure-path logs are expected from deliberately simulated provider, broker, and database errors.

Covered suites include shadow processing, cutover, legacy sentiment, business ratings/lifecycle, and rolling summaries. Cutover cases cover complete/incomplete cohorts, strict validation, factual exclusions, in-flight legacy protection, edits back to old text, transient failure, projection recovery, model pinning, rollback, readiness/backfill limits, and recreation of missing aggregates.

Local implementation verification does not activate the real pilot. A live authoritative acceptance run remains a rollout step.

## Boundaries

- Narrative/keyword generation is already independent and reads published review text. Switching sentiment does not change its provider, prompt, provenance, or evidence eligibility.
- Existing API response shapes and mobile/web interfaces are unchanged.
- The experimental-rating flag and minimum sample remain unchanged.
- Labels and numerical intensity need separate evaluation. Earlier benchmark results do not validate the star mapping or prove performance on an independent representative sample.
- Terminal failures require operator investigation. There is no new administrative retry UI, global historical backfill, automatic contract upgrade, or cross-provider failover.
