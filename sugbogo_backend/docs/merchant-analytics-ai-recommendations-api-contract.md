# Merchant AI-assisted recommendations: restricted first release

Branch: `feat/merchant-analytics-ai-recommendations`, initially based on policy commit `e3956c81`, updated by fast-forward to main `84b7fca7` on 16 October 2026 (Asia/Manila).

## Purpose and boundaries

Add explicitly requested, background, stored AI assistance to existing deterministic merchant findings. Gemini selects and orders supported actions and selects a server-approved explanation variant. The server renders the actual wording. This first release does not publish unrestricted generated prose, diagnose causes, offer open-ended growth coaching, calculate metrics, infer sentiment/theme polarity, or change scoring, moderation, business status, verification, Featured placement, or entitlements.

The user reaffirmed manual refresh for this release on 16 October 2026. Daily/monthly automatic recommendation generation is outside this branch. Consistency means using the recorded source period, deterministic facts, and validated action choices; a new Gemini request is not guaranteed to select identical ordering or wording.

Current action vocabulary:

| Finding/action code | Eligibility | Wording choices |
| --- | --- | --- |
| `UNANSWERED_REVIEWS` | Existing report finds a nonzero current published unanswered backlog | Review backlog / consider a helpful reply |
| `INSUFFICIENT_SENTIMENT` | Existing report finds the selected classified cohort below the active policy minimum | Wait for sufficient evidence / cautiously review individual feedback |
| `STORED_INSIGHTS_OUTDATED` | Existing report labels stored insights outdated | Check coverage/freshness / use current evidence cautiously |

Other findings, including unavailable tracking, unverified visibility coverage, and insufficient peers, remain disclosures. They never authorize performance advice. Missing stored content is not a reason to invoke the public-summary generation pipeline. Existing deterministic findings and actions always remain in the response. No new minimum-sample policy or tracking-completeness switch is introduced.

## Access and routes

Both routes use existing JWT authentication, `IsAuthenticated`, merchant `HasRole`, `HasMerchantPlus`, and authenticated ownership. A suspended listing retains read access for an active merchant owner; account suspension is still denied. Business IDs, user IDs, entitlement flags, prompts, model choices, thresholds, and unknown parameters are rejected.

- `GET /api/merchant/analytics/premium/recommendations/`
- `POST /api/merchant/analytics/premium/recommendations/refresh/`

GET accepts the existing `period=7|30|90|custom`, `start_date`, and `end_date` query schema. POST accepts those fields in its JSON body only (empty object defaults to 30); query parameters are rejected. Existing Manila boundary validation applies. No generation on GET, no enqueue on GET, no writes on GET, no recurring generation schedule.

POST returns the standard success envelope with `request_id`, `state`, `created`, and `source_period`. HTTP 202 means pending/running; HTTP 200 means an existing terminal result or an insufficient-data result. These are acknowledgements, not provider acceptance. A broker failure becomes `failed`/`queue_unavailable`. A worker that disappears is displayed as failed after 15 minutes; GET computes that state without saving it. A later explicit refresh can expire and replace abandoned work.

The existing global throttle applies; refresh additionally uses a fixed 3 requests/hour per authenticated user. It counts repeated requests too. Only one active refresh per business is allowed, across periods. The same owner/selection reuses its active request. Another selection while work is active returns HTTP 409 `RECOMMENDATION_REFRESH_IN_PROGRESS`. No client request ID is accepted for choosing another owner's job.

An unchanged completed historical selection with matching evidence, policy rules, boundaries, and generation contract is reused. An equivalent recent failure is reused for 15 minutes. A partial current-day selection has a changing elapsed end: a later explicit refresh can create a new snapshot, subject to throttling. No candidates produces `insufficient_data` without a provider call.

## Read response

The standard response envelope contains:

- Owned `business`, `state`, `stored_state`, `request_id`.
- `requested_selection`: calendar dates selected in the current request.
- `source_period`: original Manila dates, exact UTC start/end-exclusive and previous bounds, original `snapshot_as_of`, partial-day disclosure; null if never requested.
- `requested_at`, original `generated_at`, current `checked_at`.
- `evidence_matches`, `snapshot_only: true`, `content_available`.
- `ai_recommendations`: action code, evidence codes, explanation code, server-rendered message.
- `generation_policy`: original/current revision, original relevant rules, rule-compatibility flag.
- `provenance`: provider, model, prompt/schema versions, restricted-selection mode, successful usage/latency when reported by the SDK. No credentials or raw provider output.
- Controlled `error_code`, current deterministic `key_findings`/`recommended_actions`, source `meta`, measurement note.

States: `not_requested`, `pending`, `running`, `ready`, `insufficient_data`, `failed`, `invalidated`. Terminal stored state and effective read state are separate: a previously ready row can be invalidated without a GET write. This release conservatively withholds mismatched output instead of retaining stale AI text. It never hides deterministic fallback because AI failed.

Recommendations cover their **original exact source snapshot**. GET does not expand a saved partial-day result to cover later events. Source checks retain those bounds but use the current clock for retained current-state SQL evidence (including replies). The current fallback uses those same saved bounds; `meta.generated_at` is its check time. Frontend must label the source cutoff. Results without a stored job use the newly resolved request period. Changed calendar dates select a separate job; no automatic copying between periods.

## Evidence, semantic validation, and privacy

Build inputs from `MerchantReportService` using one scoped policy snapshot. Allow only exact source bounds, aggregate unanswered/published/classified counts, sentiment eligibility, stored insight state/coverage/generation date, availability disclosures, finding codes, and eligible action/explanation options. Do not pass the complete report to the provider.

Do not send review text, stored narratives, theme labels, review IDs, explorer/owner/business/peer identities, personal locations, moderation evidence, documents, or credentials. Mixed-language, Cebuano, and adversarial review content therefore cannot enter this first-release prompt. No theme-specific suggestions or review summarization are added. Existing public stored review insights remain public and unchanged.

Provider output must contain exactly one to three unique supplied actions, exact supporting finding codes, and one supplied explanation ID per action. Unknown keys, arbitrary prose, invented numbers, unsupported evidence/action combinations, duplicate actions, or missing evidence reject the entire result. Server wording has no outcome promises, causal diagnoses, unsupported quality judgments, or performance claims. A fallback remains available after rejection. This constrained contract validates the supported meaning; it is not a general semantic verifier for arbitrary prose.

Canonical fingerprints include allowlisted facts, exact period bounds, eligibility/disclosure findings, and relevant policy values. Original policy revision remains recorded; an unrelated policy revision alone does not invalidate content. Relevant rules currently include sentiment, narrative/mention eligibility, and peer disclosure minimums. Low-exposure/onboarding rules do not affect this feature. Provider model and prompt/schema contract changes invalidate older results. Recompute evidence before generation, after generation, and on reads. GET never repairs records.

## Storage, concurrency, retry, and failure

`MerchantRecommendation` lives in the existing merchant analytics app and uses uppercase fields. Each explicit refresh records one immutable source snapshot/period/policy and an evolving attempt state/output/provenance. Ownership is also recorded; a transferred listing cannot expose the previous owner's jobs. Raw responses are never persisted.

Lock the Business row while deduplicating requests; enqueue with `transaction.on_commit`. A PostgreSQL session advisory lock per business prevents concurrent provider work. Release it in `finally`. Recheck owner/account/Premium eligibility and the generation contract, allow at most four provider attempts, and recheck source/policy before publication. Finished/expired jobs cannot be overwritten by late results. Reads remain aggregate checks, not a SQL/Mongo atomic snapshot; changes immediately after a check are a known consistency limit.

Transient provider errors retry through Celery at 60/120/240 seconds, bounded by 300 seconds and the 15-minute job lifetime. Permanent errors and invalid output do not retry. Lock contention shares the bounded Celery retry budget. No broker/provider error body, prompt, credentials, or connection string enters the response/log. New work requires an explicit merchant refresh; no automatic recurring billing/quota use is introduced.

## Migration and deployment coordination

No new Django app or package is required. Celery, Redis integration, `google-genai`, and PostgreSQL already exist. Use the existing Gemini model/credential/timeout settings; no environment files are edited.

Persistence adds the separately approved `merchant_analytics/0002_merchant_recommendations.py` initial migration, depending on the user model and `business/0028_rename_vouch_installation_id`. Runtime also requires the policy/review-provenance schema already introduced by this branch's policy ancestor. Application migration is not authorized by test approval and has not been performed.

Latest main includes mock entitlements, policy configuration, Mongo verification, offline routes, scope traceability, and map/review updates. Both `DemoMerchantPlusEntitlement` and `MerchantRecommendation` are preserved in the app's model module. The existing mock entitlement implementation remains unchanged: enforcement off permits preview; enforcement on with mock mode off denies access; enforcement on with mock mode on requires an active owned-business demo grant. Demo activation is not paid access. No payment work is added.

Two approved **empty merge migrations** reconcile independent histories:

| Migration | Parents | Operations |
| --- | --- | --- |
| `merchant_analytics/0003_merge_entitlement_recommendations` | `0001_initial`, `0002_merchant_recommendations` | None |
| `reviews/0022_merge_media_cleanup_policy` | `0020_review_media_cleanup`, `0021_review_summary_policy_provenance` | None |

The review conflict already exists in fetched main: cleanup and policy provenance both descend from `0019_review_reliability_check_outcome`. The merchant conflict combines main's entitlement root with this branch's recommendation root. The parent operations concern distinct models/fields and remain unchanged. No applied migration is edited or renamed. Empty merges join the graph; deployment still needs the unapplied parent operations as well as the merges. Application migration needs separate approval.

## Frontend integration

Use existing SugboGo components/tokens in later frontend work. Render deterministic advice immediately, offer explicit Refresh, POST date selection, then poll GET using the same selected dates. Stop polling on terminal state. Honor 401/403, 409, 429, and policy 503; failed sources are not zero. Display exact source cutoff, original generation date, partial tracking, and restricted AI-assistance label. No changes to existing report or Standard payloads. A newly selected period never inherits a different period's stored recommendations.

Read `/api/merchant/plus/status/` for effective access instead of inferring entitlement from UI state. Normal requests must still rely on backend enforcement. Show fallback and Refresh for `not_requested`; progress for `pending`/`running`; AI choices for `ready` with `content_available`; limitation text and fallback for `insufficient_data`; controlled failure text and fallback for `failed`; withhold old choices and offer refresh for `invalidated`. Disable duplicate refresh taps and stop polling when the screen is no longer active. A 409 indicates another selection is being processed; a 429 should respect server retry feedback. Source cutoff and current check time are different labels.

Merging alone does not activate this feature: deploy approved schema migrations, configure existing provider/broker settings through the deployment's authorized environment process, and run an appropriate Celery worker. Generation remains explicitly requested; no Beat entry is added. Frontend implementation and deployed HTTP/worker/provider verification remain separate work.

## Broader recommendation backend still outstanding

This restricted release partially fulfills roadmap task 6. Gemini currently orders existing qualifying actions and selects approved wording. It does not produce theme-specific or open-ended business-growth explanations. Subsequent separately approved tasks should:

1. Expand deterministic qualifying evidence/actions using supported recurring themes, adequately sampled sentiment patterns, and other actionable aggregates. Preserve original summary windows, sampling, eligibility, privacy, and unknown tracking coverage. Never infer theme polarity or visibility growth without adequate evidence.
2. Add richer evidence-bound explanations only with reviewed claim/action rules, source bindings, semantic rejection, invalidation, and deterministic fallback. Schema or citation validity alone cannot prove arbitrary prose accurate. Calculations, policy gates, permissions, and platform decisions remain deterministic.
3. Complete live synthetic Gemini evaluation, human factual-support/usefulness review, multilingual/adversarial cases, latency/cost measurement, real JWT/deployed workers, source reconciliation, and frontend acceptance. Any scheduled refresh is a separate scope/cost decision, not implied by this release.

## Evaluation and acceptance

Automated coverage must include real PostgreSQL job persistence/locks, source/policy invalidation during generation, unchanged relevant rules after unrelated revisions, replays, duplicates, ownership/access changes, failed queue, transient retries/exhaustion, worker timeout recovery, stored-output validation, no eligible candidates, API permissions/unknown fields, no writes/enqueues/providers on GET, Standard separation, and healthy zeros versus missing tracking.

Synthetic evaluation covers sparse data, unavailable tracking, stale insights, unanswered reviews, mixed sentiment, Cebuano, adversarial text, and unsupported provider output. Record support/privacy/invalidation outcomes automatically. Human review must assess usefulness of ordering/wording and supported meaning. Live Gemini evaluation, cost/latency, real JWT/deployed workers, live source reconciliation, and frontend acceptance are separate authorized checks. Token counts do not establish monetary cost; pricing/billing is not calculated here.

From `sugbogo_backend`, the default evaluator uses synthetic reference selections, no provider calls and no database reads/writes:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py evaluate_merchant_recommendations
```

The separately authorized `--include-live-gemini` option sends only synthetic aggregate fixtures and consumes quota. Its successful results still need the returned human-review rubric completed; offline fixture acceptance is not provider-quality evidence. This branch did not execute that option.

## Recorded verification

Verified 16 October 2026 (Asia/Manila):

```powershell
# From sugbogo_backend; separately approved disposable PostgreSQL/PostGIS database.
& '..\.venv\Scripts\python.exe' -B manage.py test apps.merchant_operations.merchant_analytics apps.admin_operations.system_configuration apps.shared.analytics --noinput
```

- Before main integration: **195 tests passed in 24.123 seconds**; test database created, migrations applied there, and database cleanup completed. This is historical pre-integration evidence, not acceptance of the updated checkout.
- Django system checks passed with no issues.
- `makemigrations --check --dry-run` passed with no changes detected and database history readable outside the sandbox.
- Offline evaluator: **8/8 synthetic contract cases passed**. This is reference-selection validation, not live model quality.
- New Python files parsed successfully; production functions have docstrings; tracked and new-file whitespace checks passed.

Initial verification was blocked by sandbox access to local PostgreSQL; the approved run succeeded outside the sandbox. Development iterations exposed a no-candidate fixture that still had unanswered reviews and an ownership-transfer revalidation ordering issue; both were repaired before the final successful combined run. Expected simulated Mongo-outage logs belong to existing failure tests. Overlapping runs are not added together as unique coverage. The ancestor's 705-test run remains historical evidence, not a result for these changes.

The new migration was created and applied **only to disposable test databases**. The application database was not migrated. No live Gemini call, monetary-cost measurement, human usefulness review, real JWT/deployed-worker acceptance, frontend/native acceptance, or deployment acceptance was performed. Existing review generation remains unchanged; tests mock providers and visibility sources. Mock entitlements and both migration histories are now integrated; post-integration verification is recorded below. These verification results were recorded before the separately authorized staging/commit step. The pre-update recovery stash is retained.

### Post-integration verification

Verified against main `84b7fca7` plus the unstaged recommendation implementation and merge migrations:

```powershell
# From sugbogo_backend; disposable PostgreSQL/PostGIS databases only.
& '..\.venv\Scripts\python.exe' -B manage.py test apps.merchant_operations.merchant_analytics apps.admin_operations.system_configuration apps.shared.analytics apps.reviews apps.explorer_operations.explore_businesses.views.tests.test_business_detail_insights_views --noinput

# Focused rerun after the assertion-only repair described below.
& '..\.venv\Scripts\python.exe' -B manage.py test apps.reviews.views.tests.test_community_review_views --noinput
```

- Expanded run: **744 tests ran in 1950.253 seconds; 743 passed and one failed**. The only failure was the existing Community response test expecting a shape without `cluster_icon` and `barangay`. Main commit `9f2a9b0a` intentionally added these fields to the serializer; the expectation was updated to include the fixture's `utensils` icon and null barangay. No production Community behavior changed.
- After that test-only repair, the affected Community module passed **19/19 tests in 79.147 seconds**, including the previously failing case. The full 744-test suite was not rerun after this assertion-only change. These overlapping runs are not summed or represented as a single clean 744-test run.
- The expanded run exercised real mock-grant activation, recommendation generation with a mocked provider, read access, reset/revocation, and reset before queued generation. APIClient/direct-worker tests do not establish deployed HTTP/Celery behavior.
- Both runs created and removed their disposable test databases; application migrations were not applied.
- Django checks passed. `makemigrations --check --dry-run` reported no changes. The migration loader reported no conflicts, with final heads `merchant_analytics/0003_merge_entitlement_recommendations` and `reviews/0022_merge_media_cleanup_policy`.
- Offline evaluator: **8/8 contract fixtures passed**, without a provider call. Syntax/docstring/whitespace checks passed. The index remained empty, and the pre-update stash was retained.

The unusually slow expanded run was allowed to complete; a read-only diagnostic during execution showed no PostgreSQL lock wait. No live provider/deployment/frontend acceptance is implied by these results. The broader recommendation work described above remains separate.
