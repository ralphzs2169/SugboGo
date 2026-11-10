# Global Gemini sentiment authority

SugboGo uses the evaluated Gemini sentiment pipeline for all languages and all
businesses. OpenAI remains the review moderation provider. Sentiment and content
moderation have separate purposes, provider calls, and failure handling.

## Configuration and deployment

Set these values on **every API, Celery worker, and Beat process**:

```dotenv
GEMINI_SENTIMENT_ALL_BUSINESSES=True
GEMINI_SENTIMENT_CUTOVER_ENABLED=True
GEMINI_SENTIMENT_SHADOW_ENABLED=False
GEMINI_SENTIMENT_SHADOW_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_SECONDS=60
```

Configure `GEMINI_API_KEY` through the host's secret settings. Keep OpenAI's
moderation credentials configured separately. The business allowlist is ignored
in global mode. Global authority defaults to True; processing defaults to False
until explicitly enabled. A missing credential or paused worker cannot invoke
VADER, fastText, or RoBERTa instead.
Production settings reject `GEMINI_SENTIMENT_ALL_BUSINESSES=False`; that option
is available only in development for historical regression/evaluation work.

Do not provision or mount the DOST-ASTI model or fastText artifacts for this
release. Existing Docker exclusions already omit model weights. The current
dependency lock still contains historical ML libraries; their installation does
not load models. Removing those libraries requires a separately regenerated and
verified Linux build, and is not required for this cutover.

Before enabling processing, back up the target database and stop old releases of
all workers. Deploy the compatible API, workers and Beat together, and apply the
existing migrations through the normal deployment procedure. This change adds
no schema migration. Old workers must not continue running: they do not honor
the new global authority setting.

Run a worker consuming `gemini_sentiment_shadow` with concurrency 1 initially,
alongside the normal review/moderation, rating, and insight queues. The existing
Beat recovery task repairs missed scheduling, retries and projection callbacks.
Keep one Beat scheduler. Check the broker, migration status and all worker
queues before enabling inference.

## Inspect and roll out

From the deployed backend directory, the default command is read-only:

```sh
python manage.py rollout_gemini_sentiment --limit 20
```

It reports readiness, current Gemini policy or pending cutover, exact model and
contract version, current failed jobs, and a pagination cursor. No credentials,
review text, provider calls or mutations are included in the report. Failed-job
counts include retryable and terminal failures; they are observations, not a
count of individual API attempts. Inspect job state/retry timestamps when a
business remains incomplete.

Explicitly queue a maximum of 100 missing review observations across that page,
and activate businesses whose entire published nonblank cohort is ready:

```sh
python manage.py rollout_gemini_sentiment --queue --activate --limit 20 --review-limit 100
```

Repeat the same page after workers finish, and traverse subsequent pages with
`--after-business-id <next_after_business_id>`. A null next cursor means the last
page, not that all businesses have completed. Revisit pages with pending or
failed reviews. Queueing never resets exhausted jobs or directly calls Gemini.
The normal recovery task also discovers missing historical demand in bounded
batches. Enabling processing therefore authorizes historical API work; enable
it only when the initial backfill budget is available.

The final ready review normally triggers automatic whole-business activation;
the command and recovery task repair missed callbacks. Activation revalidates
every required result under transaction locks. Incomplete cohorts retain their
previous stored aggregates until replacement is complete. Old cached scores are
not relabeled as Gemini output. New sentiment requests use Gemini only, including
for businesses awaiting activation. New businesses require no allowlist entry:
their first complete review cohort activates automatically. Empty businesses
can also be activated explicitly by the rollout command without a provider call.

Already active businesses retain their database-pinned model and contract.
Changing the environment model does not upgrade them. The existing snapshots,
source-text hashes, edit/deletion invalidation and in-flight write fences remain
in use. Factual/uncertain exclusions stay published with no contribution to stars
or classified sentiment counts. The minimum contributor threshold and existing
score-to-star mapping are unchanged.

## Failures, pause and acceptance

Transient failures and malformed outputs use the existing maximum of three
attempts; terminal failures need operator investigation. No failure creates a
neutral label, a score, or legacy inference. Sentiment failure does not override
the independent moderation/publication rules.

To pause sentiment, set `GEMINI_SENTIMENT_CUTOVER_ENABLED=False` on all processes.
For an immediate stop, stop sentiment workers too: an already running callback
can finish projecting ready data. Keep `GEMINI_SENTIMENT_ALL_BUSINESSES=True`.
Stored results remain readable and missing demand is recovered after resumption.
The legacy rollback command is rejected in global mode. Restore a compatible
release or repair the provider while processing is paused; do not deploy a
release that reintroduces restricted-model inference.

Before public access, verify submission, moderation approval, edit, deletion,
factual exclusion, provider failure/retry, rating thresholds, merchant/admin
counts, and a newly registered business without an allowlist entry. Check that
all business pages report Gemini authority and zero not-ready reviews, and
confirm workers never read local model files. Repository tests use mocked
providers and a disposable PostgreSQL database; they do not establish hosted
credentials, actual spending, or a completed production rollout.

Monitor actual token usage, queue depth, retries, latency and worker memory.
Concurrency 1 and three attempts bound simultaneous work and retries, not total
spending; enforce hosting/account controls and application intake limits for
your budget. Minimize personal information in review text and review the privacy
notice before hosted acceptance. The existing synthetic benchmark supports the
provider choice but does not establish population accuracy or calibrate stars.
