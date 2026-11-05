# Controlled Gemini shadow pilot

Executed 3 November 2026 on `feat/gemini-review-sentiment-pipeline`, against local database `sugbogo_ralph_20261031`. This records live task delivery and inference, not activation of authoritative Gemini ratings.

## Changes made

- Backed up the database to `tmp/shadow-pilot-20261103/before.backup`; captured pilot review/status/sentiment and summary-count fields in `before.json`.
- Reviewed the scoped migration plan and applied only reviews 0029, 0030 and 0031. Unrelated payment and administrative migrations were not applied.
- Enabled shadow processing in local backend `.env` for business ID 11 only (Sugbo Demo Business 25), model `gemini-3.5-flash-lite`.
- The original broker configuration was unset. Started an isolated official `redis:7-alpine` container named `sugbogo-shadow-pilot-redis`, bound to localhost port 6380, and configured Celery to use `redis://127.0.0.1:6380/0`. The existing Redis container on 6379 was not replaced.
- Routed shadow processing and recovery tasks explicitly to `gemini_sentiment_shadow`. Started hidden local backend, a legacy queue worker, a dedicated shadow worker and a recovery dispatcher. Backend OPTIONS `/api/auth/login/` returned HTTP 200. Both workers responded to ping and subscribed to their intended separate queues.
- Queued existing published reviews 82, 83, 84, 121 and 122. No existing review text was edited or deleted and no new user review was fabricated.

## Live results

| Review ID | Legacy label | Shadow label | Shadow score | Rating eligible | Attempts |
|---|---|---|---:|---|---:|
| 82 | positive | positive | 1 | Yes | 1 |
| 83 | negative | positive | 1 | Yes | 1 |
| 84 | negative | negative | -1 | Yes | 1 |
| 121 | negative | negative | -0.5 | Yes | 1 |
| 122 | negative | negative | -1 | Yes | 1 |

All five results reached ready. The change in interpretation for review 83 is evidence for human inspection, not a gold-label accuracy result. The text expresses surprise at a pleasing view; no independent human intensity annotations were collected for these live reviews. No shadow aggregate was promoted to a business rating.

Authoritative checks: all six existing review status/legacy-label/legacy-score rows for business 11 matched the before snapshot (five were published). Its existing summary counts also matched. BusinessRating and authoritative ReviewRatingResult tables each remained empty. A review from business 9 was skipped by the cohort gate. Re-requesting review 82 returned its same job. An actual duplicate task delivery returned ready; all attempt counts stayed at one, demonstrating no repeat inference for that delivery. Recovery messages reached the shadow worker and returned zero when no jobs were due.

Evidence: `docs/evidence/gemini-shadow-pilot-2026-11-03.json`; local process logs in `tmp/shadow-pilot-20261103/`. The JSON records five provider results and per-request usage. No review text or API key was printed in worker task logs by the shadow service.

## Scheduler correction and observed side effect

The first attempts to isolate Celery Beat merged the project's default schedule rather than replacing it. Those pilot scheduler processes were stopped. Initial unrelated recovery tasks mostly reported zero work; one existing review-insight job later refreshed the Vibe narrative for business 9 at 04:49:18 UTC (12:49:18 Manila). This was an old-pipeline operation, not a shadow observation. The narrative was not reverted; the pre-pilot database backup is retained. Do not describe the entire platform's summaries as untouched.

The final pilot recovery process is an explicit dispatch loop sending only `recover_gemini_sentiment_shadow` every 60 seconds to the dedicated queue. It does not instantiate global Celery Beat. This proves live shadow recovery delivery, not acceptance of the global Beat deployment configuration. The source's normal Beat entry remains available for a later fully planned deployment.

## Current operating state

Local shadow mode remains ON only for business 11. New published reviews and accepted text edits for that business can create shadow demand through the independent after-commit observer. The legacy worker continues to process the original queue and remains authoritative for public sentiment/ratings. Outside the pilot cohort, no shadow jobs are created. This pilot used the explicit queue command for existing reviews; new HTTP submission/edit/deletion/moderation flows were not exercised live. Their race and invalidation safeguards were covered in the earlier 74-test disposable-database suite.

Services were started hidden and remain running so the user can exercise the app. Runtime helpers are `tmp/shadow_pilot_runtime.py`, with process IDs/logs in the pilot directory. `processes.json` records the initial processes; its original Beat PID is obsolete. The replacement recovery PID is in `recovery.pid`. Python launcher processes may have child Python processes; identify exact command lines before stopping them. Do not start another backend or workers on the same queues without checking these processes.

To pause: set `GEMINI_SENTIMENT_SHADOW_ENABLED=False` in local `.env` and restart the backend/shadow worker under the existing process arrangement. Do not reverse the migration or restore the entire database merely to pause. Previous broker/shadow setting values are saved in `tmp/shadow-pilot-20261103/config-before.json`; no API key was copied into that configuration snapshot. Preserve the Redis broker while legacy work still uses it. No migration reversal, database restore, source commit or GitHub push was performed.

Next acceptance work: live app submission/edit/deletion with designated disposable reviews, an administrator status transition, provider failure/recovery observation and independent intensity validation before any authoritative cutover. Successful analysis of five existing reviews does not replace those checks.

## Live submission and approval follow-up

The user submitted test review 126 through the emulator for business 11. It initially remained Under Review because the existing moderation configuration was missing; the shadow gate correctly did not analyze it before publication. The user then approved it through the admin workflow.

After approval, review 126 was published. The old pipeline stored positive sentiment with score 0.743. Separate shadow job 6 completed ready in one attempt with positive label, score 0.5, eligible true and reason evaluative. Its source text matched the submitted review exactly. The business aggregate remained on legacy-unverified-v1; the Gemini shadow result did not become an authoritative rating input. This verifies live submission-to-admin-publication-to-both-pipelines delivery. Edit/deletion and failure/recovery exercises remain outstanding.

## Live edit follow-up

The first edit was correctly refused while OPENAI_API_KEY was missing; original text stayed published. The user supplied the key locally, a harmless moderation request succeeded, and backend/legacy worker processes were reloaded. The user then successfully edited review 126 through the emulator to: “The view was nice, but we waited too long and the staff did not assist us. Overall, I was disappointed.”

The edited review remained published. Legacy sentiment became negative/-0.5023. New shadow job 7 reached ready in one attempt with negative/-1, eligible true, reason evaluative, and exact edited source text. Job 6 retained its original positive/0.5 result as historical evidence bound to the old text; its ready state does not make it a current result. No consumer should select observations merely by review ID or ready state without checking current source text and scoring version.

The authoritative business aggregate recalculated on legacy-unverified-v1 (stored value 1.7494280923), not the Gemini shadow score. This is an expected consequence of the user's accepted edit through the old authoritative pipeline. Live deletion remains to be exercised; no user review was deleted by the agent.

## Live deletion follow-up

The user deleted disposable review 126 through the emulator. Read-only verification confirmed the review no longer exists, both shadow observations (jobs 6 and 7) were cascade-deleted, and no authoritative ReviewRatingResult remains for that ID. The five original pilot shadow observations remain ready and unaffected.

Business 11's legacy aggregate completed requested revision 5 (completed revision also 5), retained legacy-unverified-v1, and returned ready with five contributing reviews and stored value 1.7002337108. No Gemini shadow score became authoritative. This completes the live submission, administrator approval, accepted edit and author deletion exercise for one designated test review. Provider failure/recovery under controlled fault injection, broader cohorts and calibrated human intensity validation remain separate acceptance work.

## Controlled failure and live recovery

A separate disposable, passwordless test author and non-community test review were created for business 11. The service's provider call was mocked to raise one TransientGenerationError while durable job state used the real local database. Assertions confirmed failed state, one attempt, null score, no label and a scheduled retry. The review stayed published with no legacy sentiment score. This was controlled fault injection, not an actual Gemini outage.

Only that fixture's retry deadline was accelerated. Recovery dispatched through the real broker; the real shadow worker called Gemini and completed ready on attempt two, positive/1.0 and eligible. No legacy score was written. The fixture's observation, review, automatically created Pocket collection and passwordless author were removed afterward. Cleanup initially hit an unrelated missing PAYMENT table when Django traversed author relations; the exact disposable review/Pocket were removed normally and only its author was deleted directly with FK checks intact. No unrelated payment migration was applied.

The five published original review IDs and one pre-existing held review remained; the legacy rating retained value 1.7002337108, contributing count five and legacy-unverified-v1. Evidence is `docs/evidence/gemini-shadow-failure-recovery-2026-11-03.json`. This establishes the tested transient-failure-to-live-recovery path, not general provider availability or score calibration. The retry-limit, permanent-failure, malformed-output and concurrent-worker boundaries are covered separately by the automated tests.
