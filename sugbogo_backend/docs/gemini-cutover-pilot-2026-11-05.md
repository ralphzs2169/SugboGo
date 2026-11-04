# Controlled Gemini cutover pilot — 2026-11-05

Branch: `feat/gemini-review-sentiment-cutover`; implementation commit: `9aef3fa7`.

## Preparation completed

- The original backup and six-review snapshot are retained privately under `tmp/cutover-pilot-20261103/`. A fresh backup including all 36 current rows was saved under `tmp/cutover-pilot-20261105/`. Both are excluded from Git.
- Applied reviews migrations `0032` and `0033`; no unrelated migrations were applied.
- Seeded 30 synthetic comments, review IDs 128–157, in Sugbo Demo Business 25 (database ID 11). They use passwordless synthetic accounts named `Pilot Test 01` through `Pilot Test 30`, an invalid email domain, and the moderation metadata tag `gemini-cutover-pilot-20261103`.
- The comments cover English, Cebuano, Taglish, and Cebuano-English; strong/mild sentiment, balanced and neutral evaluations, facts, ambiguity, sarcasm, negation, and instruction-like content.
- Synthetic comments are published database fixtures and are hidden from the community feed. This bypasses submission/moderation and does not establish end-to-end moderation acceptance or independent model accuracy.
- The target cohort has 35 published nonblank reviews: five existing and 30 seeded. One existing held review is outside the scoring cohort.
- Restored the isolated Redis container on port 6380 and restarted the backend, legacy-queue worker, dedicated Gemini worker, and shadow-only recovery dispatcher with cutover-aware code. No global Celery Beat scheduler was started.
- Enabled the local cutover gate; authority changes only through the explicit activation command.

## Evidence and acceptance boundaries

The first live pass stopped at 34/35 ready observations. Review 155 exhausted three automatic attempts; a diagnostic response marked a factual comment ineligible but supplied zero instead of null. Validation rejected it, and no activation or score override occurred. See `docs/evidence/gemini-cutover-contract-failure-2026-11-05.json`.

The schema now constrains score, label, eligibility, and reason together through conditional `anyOf` branches. One diagnostic call returned the required factual null, but a full reanalysis again exhausted three attempts on review 155. Conditional schema enforcement alone therefore did not resolve the observed provider behavior; both failed jobs (36 and 71) are retained.

The final repair adds explicit, versioned provider-boundary canonicalization: only an exact neutral, ineligible factual/uncertain response with a numeric zero placeholder has that placeholder discarded to null. This preserves eligibility and contributes no rating. Other contradictions remain invalid; an eligible balanced zero remains a genuine neutral contribution. Every correction is recorded in observation usage metadata as `excluded_zero_to_null`. Strict persisted-output validation remains unchanged. The policy change generates another contract version and requires complete cohort reanalysis. All **122 transition regression tests passed**, along with system and migration consistency checks.

Provider schema reference: https://ai.google.dev/gemini-api/docs/structured-output

Machine-readable results and synthetic text/results are recorded in `docs/evidence/gemini-cutover-pilot-2026-11-05.json` after successful activation.

## Recorded outcome

- Activated Gemini authority for business 11 only after all **35/35** published nonblank comments were valid under the final contract.
- **27 eligible** contributions and **8 exclusions**; eligible labels: 10 positive, 11 negative, 6 neutral.
- Exact aggregate: **2.9259259259**; existing API serializer rounds this to **2.9 stars**.
- One factual placeholder (review 155) was explicitly normalized to null and marked in usage metadata. No excluded zero contributes three stars.
- Preserved 36 legacy snapshots, including the held review, for rollback.
- Verified classifications and rating aggregates outside business 11 were unchanged across activation.
- The actual authenticated local HTTP review-list request returned **200 / success**.
- Stopped the four temporary extra workers after completion; the regular backend, legacy queue worker, dedicated Gemini worker, and bounded recovery dispatcher remain running.
- Code verification: **122 tests passed**, system checks passed, no migration drift, and whitespace checks passed.

The experimental star-display flag remains disabled; automatic aggregate updates are enabled. Backend rating calculation and serialization can be verified independently of frontend visibility. Enabling global star display is a separate rollout decision.

The 122-test transition regression result covers rollback, edit/deletion invalidation, provider failures, stale worker fencing, rating isolation, and exclusion-placeholder handling. The seeded live pilot supplements those tests with real provider/worker execution; it does not replace emulator/admin acceptance.

Next manual acceptance: submit and approve a new review, edit it, then delete it in the emulator/admin flow. Confirm the matching Gemini result and aggregate revisions after each action. Preserve the seed manifest for later cleanup; do not delete real reviews or blindly cascade-delete synthetic users through unrelated unmigrated modules.
