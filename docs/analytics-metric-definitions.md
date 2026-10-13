# Analytics metric definitions and shared foundation

This dictionary implements the definitions in `docs/analytics-plan.md` and the subsequently agreed Standard/Premium split. The repository is the implementation reference. Task 1 adds shared helpers and read-only aggregation; Task 2 adds admin overview and discovery-trend endpoints. Neither introduces entitlement checks, models, migrations, payment processing, new dependencies, or registered Django apps.

Task 3 adds admin coverage, business attention and provisional low-exposure candidates without altering those boundaries.

## Product access

Standard merchant analytics provides period counts and current snapshots: profile visits, distinct visitors, saves, current Pocket holders, valid specialty support, published review volume, unanswered reviews and reply rate. Premium includes expanded merchant analysis, historical charts, period comparisons, local peer benchmarks and reports. Existing public review summaries, sentiment and frequent mentions remain public; Premium is not exclusive access to those existing public fields.

Later endpoint work must keep Standard and Premium serializers/responses separate while sharing internal aggregation. Premium views must retain authentication, merchant role and business ownership checks even while subscription enforcement is disabled. The future entitlement permission is out of scope for this foundation.

## Metric dictionary

| Metric | Definition and population | Time interpretation | Merchant tier |
|---|---|---|---|
| Impressions | Count stored IMPRESSION events from qualified business-card exposure. Existing tracking deduplicates explorer/business/type per UTC day. Not raw screen renders. | Event timestamp inside the selected period. | Expanded visibility analytics: Premium. |
| Profile visits | Count stored PROFILE_VISIT events. Daily deduplication means this is not every profile opening. | Event timestamp inside the selected period. | Standard count; Premium trend/comparison. |
| Distinct profile visitors | Count distinct explorer IDs across all eligible PROFILE_VISIT events in the entire selected period and business scope. | Period-wide distinct, not sum of day/business distincts. | Standard count; Premium trend/comparison. |
| Pocket SAVE events | Count recorded SAVE events derived after Pocket creation commits. Re-saving can contribute on another UTC day; same-day duplicates are suppressed. | Event timestamp inside the selected period. | Standard count; Premium trend/comparison. |
| Distinct savers | Count distinct explorer IDs across recorded SAVE events within the period and scope. | Period-wide distinct. | Premium detailed interest analysis. |
| Current Pocket holders | Count current BusinessPocket records for the business. Unsave deletes a record; this is not total historical saves. | Current SQL snapshot, unaffected by selected event dates. | Standard. |
| Specialty support | Current valid specialty evidence under the maintained vouch rules, grouped by active specialty; report endorsements separately from distinct supporters. One explorer may support multiple specialties. | Current snapshot. Historical rows can disappear through unvouch; retained history is required for complete additions/removals and historical charts. | Standard snapshot; Premium history once supported. |
| Review volume | Eligible currently published reviews created within the selected period, evaluated at the report cutoff. Current published total is a separately labeled snapshot. | Historical results can change after deletion/moderation; this is current-state reporting, not a historical status snapshot. | Standard counts; Premium trends. |
| Positive share | Positive classified eligible reviews / all classified eligible reviews x 100. Unclassified reviews do not enter the denominator. Pool counts across businesses before dividing. | Use the report's declared eligibility/window; stored summaries retain their own coverage dates. | Premium merchant analysis; existing public sentiment remains available. |
| Reply rate | Eligible published reviews created within the period with a merchant reply by calculation cutoff / eligible published reviews created within that period x 100. | Cohort based on review creation; disclose reply cutoff. Zero eligible reviews gives null. | Standard rate; Premium trend. |
| Unanswered reviews | Eligible currently published reviews without a merchant reply. State explicitly whether the count covers the period's cohort or all current published reviews. | Period cohort or current snapshot, never an unlabeled mixture. | Standard review management. |
| Median first-reply time | Median elapsed time from review creation to first merchant reply, among replied eligible period reviews. Pair with unanswered count to avoid hiding nonresponses. | Period review cohort; reply cutoff disclosed. | Premium. |
| Discovery-active explorers | Distinct explorers with any supported visibility event in the selected period and scope. Count each explorer once across event types and businesses. | Period-wide distinct. Not full app MAU, account ACTIVE status, or last_login. | Admin platform activity; merchant equivalent means explorers engaging with that business. |
| Active businesses | Businesses with current `BUSN_STATUS=ACTIVE`, independent of verification and owner account status, matching maintained explorer queries. | Current snapshot; historical value/change is null without retained status snapshots. | Admin. |
| Approved businesses | Existing businesses with a linked merchant application whose current `MAPP_STATUS=APPROVED`. Includes subsequently suspended businesses; excludes unlinked approved applications. Not the legacy `BUSN_IS_VERIFIED` flag. | Current snapshot; historical value/change is null without retained inventory snapshots. | Admin. |
| New explorer accounts | Accounts created in the selected period with current `USER_ROLE=EXPLORER`, including every account status. Group weekly using Manila Monday boundaries. | Period reporting against current role; later explorer-to-merchant changes revise results. | Admin. |
| Recorded coverage | Currently active businesses with at least one recorded PROFILE_VISIT in the period / currently active eligible businesses x 100, by current cluster/category. Overall coverage pools business counts. | Selected event period against current inventory/classification. Empty denominator gives null; failed tracking gives null visited counts/percentage. | Admin. |
| Business attention | Profile visits, SAVE events, distinct savers per business in the period, plus current valid vouches and distinct supporters for active specialty links. | Period visibility plus explicitly current support; zero recorded visits retained after healthy reads. | Admin. |
| Low recorded attention with specialty support | Currently active business with at most four recorded profile visits in the last 30 completed Manila days and at least five distinct current valid specialty supporters. | Fixed recent window excluding today, independent of selectable chart periods. Provisional while tracking coverage is unverified. | Admin. |

Task 2 implements SQL inventory/account counts and admin discovery reports; specialty/review metric implementations remain deferred. Existing application approval, resubmission and SLA definitions remain unchanged. Discovery Score is an opportunity/credibility ranking signal, not satisfaction, measured exposure or revenue; do not alter its computation.

## Reporting periods

- Reporting timezone: `Asia/Manila`; query bounds and storage remain UTC. Do not change backend TIME_ZONE or existing UTC event deduplication.
- Presets are 7, 30 and 90 calendar dates including today. Default is 30. The effective end is capped at one captured aware `now`; today's observations are incomplete.
- Custom input is inclusive ISO start/end dates, ordered and not future-dated. It is converted to `[Manila start midnight, midnight after end date)` and capped at the captured `now`. Empty elapsed ranges are rejected.
- Previous period immediately precedes the current effective start and has exactly the same elapsed duration. This differs from existing application-dashboard weekday comparisons; Task 1 leaves those comparisons untouched.
- Mongo filters use `occurred_at >= start` and `occurred_at < end`.
- Daily buckets use Manila midnight. Weekly buckets start Monday in Manila. First and last returned bucket query bounds are clipped to the requested period.
- Event counts retain UTC deduplication even when grouped into Manila dates. They are not newly deduplicated Manila-day visitors. Period-wide visitors use distinct IDs.

## Comparison contract

`compare_values` returns a signed `value`, `direction`, `unit` and `reason`. Available comparisons have a null reason; unavailable comparisons have null value/direction and a machine-readable reason.

- Count change: `(current - previous) / previous x 100`, unit `percent`. A zero prior value yields no relative comparison.
- Rate change: `current_percentage - previous_percentage`, unit `percentage_points`. Inputs use a 0-100 scale and require positive current and prior observation denominators. A valid previous rate of 0% is not an empty denominator and can be compared.
- Both periods must meet the caller's explicit sample requirement; missing evidence or unavailable data suppresses comparison. The generic minimum is one; metric owners must supply their established threshold rather than assuming this is a universal statistical threshold.
- Review sentiment currently requires five classified reviews for Review Vibe; generated summaries have their own eligibility rules. Application trends currently use ten observations. Reuse the owning feature's maintained constants when those endpoints are implemented.
- A rate with no denominator is null, never 0%. A missing comparison is not a zero change.

## Read-only visibility helpers

Methods are added to the existing `VisibilityEventService`; existing methods are not redirected to them.

| Method | Output |
|---|---|
| `get_analytics_totals` | IMPRESSION, PROFILE_VISIT and SAVE recorded-event counts for the selected window. |
| `get_analytics_series` | Observed bucket/type counts with Manila date and clipped UTC start/end. Sparse series: absent buckets are not fabricated. |
| `count_analytics_explorers` | One period-wide distinct explorer count, optionally restricted to one event type. |
| `get_analytics_explorer_series` | Distinct explorers per Manila day/week across businesses and supported event types. Bucket counts must not be summed to obtain period-wide distincts. |
| `get_business_attention_metrics` | Explicit business-keyed profile visits, saves and period-wide distinct saver counts. Healthy missing business events give zero; failures raise the controlled tracking exception. |
| `get_first_observed_events` | Earliest observed UTC timestamp per type across retained events in scope; null where none exists. No period filter. |

All methods accept `business_ids=None` for the platform, `[id]` for a business, or an explicit set/list. `[]` is an empty scope, never platform-wide. Positive integer IDs are normalized using the existing helper. These internal reads do not enforce ownership or filter to currently active businesses: future endpoints must resolve authorization and the intended business population before calling them. Silently excluding a suspended business would alter historical reporting.

Distinct counting uses Mongo grouping and a count stage; explorer identities are never returned. The maintained collection is `discovery_visibility_events` with `event_type`, `business_id`, `explorer_id`, and `occurred_at`.

Read pipelines never invoke `ensure_indexes`, create indexes, write documents, or use output/merge stages. They reuse the existing failure cooldown, PyMongo exception translation and recovery handling. Cursor iteration errors are also failures. A failed aggregation raises `VisibilityTrackingUnavailable`; callers must represent this as unavailable metadata with null affected metrics, never catch it and substitute zero.

Healthy empty results mean zero recorded events and zero recorded distinct explorers, not proof that no real-world activity occurred. Only fill missing time buckets with zero when a later caller has an explicit verified-coverage policy.

## Metadata contract

`build_meta` returns a dictionary intended for `data.meta` inside the existing `success_response(data=...)` envelope. Do not add new top-level response fields or change `core/responses.py`.

| Field | Meaning |
|---|---|
| `period` | Requested Manila dates, timezone, effective UTC bounds and equal-duration prior bounds. End bounds are exclusive. |
| `generated_at` | The aware clock captured for the report period, serialized in UTC. |
| `data_through` | A caller-verified source cutoff in the effective period. Null if unknown or unavailable. Do not use the last event timestamp as a completeness watermark. |
| `availability` | `available`, `partial`, or `unavailable`. Known incompleteness/unknown coverage changes available to partial. |
| `is_partial` | True for partial or unavailable reports. |
| `partial_reason` | First machine-readable reason, or null. |
| `partial_reasons` | All distinct reasons: current-day incomplete, unverified coverage/freshness, lag, source failure, or caller-supplied facts. |
| `coverage_verified` | Explicit caller assertion; false by default. |

First-observed events do not prove tracking activation, uninterrupted uptime, retention completeness or zero activity before that date. Pocket creation can succeed while its visibility event is lost. No outage history or authoritative coverage ledger is introduced by this task. Therefore default metadata conservatively labels coverage/freshness unverified. Mixed-source endpoints later need per-source metadata so a Mongo failure does not erase healthy SQL snapshots.

Stored AI summaries must retain their state, sampling disclosures, generated timestamp and original coverage window. Analytics requests must read stored summaries and never invoke Gemini. Overlapping mention counts cannot be added as mutually exclusive proportions.

## Manuscript and plan differences

- Product decision: Standard/Premium separation supersedes the initial merchant MVP presentation in the plan/PDF. Expanded analysis, historical charts, local peer comparisons and reports are Premium; existing public review insights stay public.
- Storage: manuscript examples use separate impression/profile-visit collections and Mongo-based reviews. Analytics uses the maintained unified Mongo visibility collection and SQL review/domain records instead; do not recreate manuscript schemas.
- Date comparison: new shared reports use immediately preceding equal-duration windows. Existing application analytics keeps its established weekday-based comparisons.
- Coverage: the earliest event is a first observation, not a certified tracking start. Complete tracking cannot be inferred from current availability.
- Task 2 product decision: use approved-business inventory rather than the verified flag. Maintained application approval creates an active business without setting that flag. Analytics does not change that workflow or backfill flags.
- Task 3 product decision: low-exposure pilot thresholds are owned by admin analytics constants (30 completed days, at most four profile visits, at least five distinct valid supporters). A roughly monthly reporting window is consistent with comparable analytics patterns, but the numeric selection cutoffs are not industry-certified benchmarks.
- Low-exposure window differs deliberately from selectable 30-day charts: it excludes today. Businesses created inside that window disclose shorter business histories; those created at/after its exclusive end have no observation opportunity and are not selected. Business-age flags do not certify actual tracking coverage.
- Deferred: navigation-start analytics, conversion funnels, peer comparisons and historical specialty/score charts require later instrumentation, population definitions or retained history. Separate totals do not establish a conversion journey. Integrated payment processing remains excluded.

## Proposed indexes, not created

The existing visibility store already declares unique dedupe and `(event_type, business_id, occurred_at)` indexes on its write path. New read methods do not initialize them.

For later review using deployed query plans, consider `(occurred_at, event_type)` for bounded platform totals, `(business_id, occurred_at, event_type)` for scoped reports, and `(event_type, occurred_at)` for earliest-event lookups. These are candidates only: inspect existing deployed indexes, event volume and execution statistics before selecting or creating any. Mongo `$dateTrunc` requires server 5.0 or newer; confirm the deployed server before enabling series endpoints. No dependency/server upgrade is performed here.

## Verification scope

Tests cover Manila/UTC boundaries, default and custom periods, equal elapsed prior periods, daily/Monday-week grouping, clipped buckets, repeated explorers across dates/businesses/types, zero vs unavailable results, invalid scopes, source and cursor failures, cooldown recovery, first-observed events and metadata limitations. New service tests use in-memory fixtures and forbid index initialization; they do not require a real MongoDB service or create domain rows. A live Mongo compatibility/query-plan check is deferred until approved infrastructure validation.

Task 2's SQL service tests require a disposable PostGIS test database. API access/contract tests and Mongo aggregation tests use in-memory fixtures/mocks. Refer to `sugbogo_backend/docs/admin-analytics-api-contract.md` for endpoint behavior, per-source metadata, and frontend acceptance checks. Visibility growth comparisons are deliberately null while coverage is unverified; there is no client-supplied coverage override.

Task 3's SQL/service and API pagination tests also require a disposable PostGIS test database. They cover current eligible populations, pooled percentages, valid versus cached specialty counts, distinct supporters, fixed-window boundaries, server-owned threshold overrides, globally sorted pagination, Mongo failures and preserved classification-management statistics. Real Mongo performance and business-population scale still require infrastructure validation.

## Task 4: approved admin operations definitions

This task uses PostgreSQL domain records. It adds no tracking, scoring, payments, migrations or dependencies.

### Onboarding and approved legacy exceptions

Reuse `MerchantApplicationAnalyticsService.get_application_statistics()` unchanged. Its existing definitions remain authoritative for this section: pending applications have current `submitted` status; approval rate is approved / (approved + rejected) by current application status; SLA compliance uses review events with a recorded, non-null SLA outcome. Empty rate denominators remain null. Existing trends, sample thresholds, and histories retain their native semantics.

**User-approved exception:** existing onboarding statistics retain configured UTC reporting and their native comparison windows, rather than adopting the shared Manila period/equal-adjacent-window rules. The legacy weekly window runs Monday through the current date, compared with the same elapsed dates in the preceding week. Existing daily histories cover seven dates. The response exposes this through `legacy_meta`, including `selected_period_applies=false`; the selectable period must not be presented as filtering these legacy outputs. No global timezone or existing service behavior is changed.

New weekly activity uses the selected Manila period, Monday-based weeks, clipped half-open boundaries, and zero-filled event counts. Submissions count `MerchantApplicationSubmission` rows by `MASUB_SUBMITTED_AT`, including resubmissions. Completed reviews count approved/rejected `MerchantApplicationReview` rows by `MAREV_REVIEWED_AT`, including unlinked legacy review records. Neither is a distinct-application count.

Pending application aging is a current snapshot, independent of the selected period. Use existing weekday counting with configured UTC dates, excluding the submission date and without a holiday calendar. Reuse the application-owned constants: `on_time` is under 3 business days; `approaching` is 3–4; `overdue` is 5+. Missing or future submission times enter `unknown_age`. Do not apply report/dispute elapsed-hour buckets to the onboarding SLA.

### Attention queue and completed disputes

Open reports are individual `ReviewReport` rows currently `pending`. Open disputes are `MerchantReviewDispute` rows currently `pending`. Both include the whole current backlog, irrespective of the selected period. No prior backlog or backlog growth comparison is fabricated.

Elapsed age buckets are exhaustive: `under_1_day` is [0,24) hours; `days_1_to_2` is [24,72); `days_3_plus` is 72 hours or more. Exactly 24 hours enters the middle bucket, exactly 48 remains there, and exactly 72 enters the last bucket. Missing/future creation timestamps enter `unknown_age`. This is elapsed duration, not local midnight crossings or business days.

Report timestamps are `RREP_CREATED_AT`, `RREP_UPDATED_AT`, and nullable `RREP_WITHDRAWN_AT`. There is no dedicated report resolution timestamp. Administrative approval/rejection audit entries exist, but complete lifecycle/backlog history is not verified. Do not substitute updated time for resolution time or claim that no audit records exist. Metadata discloses current-state queues and unavailable complete queue history.

Dispute timestamps are `MRDSP_CREATED_AT`, `MRDSP_UPDATED_AT`, and nullable `MRDSP_RESOLVED_AT`. There is no `COMPLETED` status: completed means current `upheld` or `dismissed`. Withdrawn disputes are excluded even when they have resolution timestamps.

Median turnaround is elapsed hours from creation to resolution for completed disputes whose resolution timestamp is within the selected Manila period, using [start,end). It is a recorded resolution-period cohort based on retained current statuses, not reconstructed state history. Return null median and sample count 0 for no valid observations; a valid zero-hour duration is retained. Negative/missing creation durations are excluded and counted. Completed disputes missing resolution times are counted separately across all current completed records, because they cannot be assigned to a period. Timestamp anomalies and unverified historical coverage are disclosed; deleted records or missing lifecycle history are not reconstructed.

## Merchant Premium: approved definitions and retained-history limitations

Premium has separate authenticated owner-derived URLs, all protected by `HasMerchantPlus`. The default-off enforcement toggle permits active merchant previews; the current server stub fails closed with PLUS_REQUIRED when enabled. No Standard response gains Premium fields. No plan model, migration, payment, Gemini request processing, tracking deduplication or Discovery Score changes are included.

Visibility/Pocket series use Manila day/Monday-week buckets and current/prior equal elapsed windows. Profile visitors filter PROFILE_VISIT and distinct savers filter SAVE. Period uniques are independent whole-period distinct counts, never sums of bucket uniques. Mongo errors return null/unavailable. Successful recorded totals do not establish complete tracking: growth changes stay null with coverage_unverified, consistent with admin discovery, until a later approved coverage mechanism exists. Sparse tracking gaps are not zero-filled.

Specialty weekly creation cohorts include current active specialties and retained valid vouches only: **Added and still valid**. Unvouch deletions and current validity/activation changes prevent true historical additions/removals/balances. Durable lifecycle events, an agreed baseline and retention policy would be needed separately; lost deleted records cannot be reconstructed.

Stored review insights retain their own 30-day coverage/state, safe public content gate, sampling counts and freshness timestamps. They are not generated for the selected analytics period. Five eligible nonblank reviews are required for generated content; five classified reviews for sufficient sentiment/overall vibe. Counts/shares retain the established contract, without fabricated mention polarity or private review evidence. Missing stored summary is null, not a fabricated empty summary. Existing stored empty sentiment shares are 0.0; selected-period trend empty shares are null, explicitly documented.

Review trends use current published review-creation cohorts and stored positive/neutral/negative labels; shares pool classified counts and exclude unclassified reviews. Reply-rate cohorts use generated_at as the reply cutoff, following Standard. Median elapsed first-reply duration uses retained valid replied records only, with sample size and null for no replies. Deletion/recreation can lose original reply history. Unanswered backlog covers all current published reviews. Rate comparisons use percentage points and require a nonzero eligible denominator in each cohort. Moderation, classification and deletion history are not reconstructed.

Legacy discrepancy: the generation policy excludes spam/device-abuse-flagged reviews for generated content, while maintained stored sentiment recomputation uses published status/date filters. Analytics preserves and documents this behavior without changing generation. Detailed routes, payloads, limits and integration checks are in `sugbogo_backend/docs/merchant-analytics-api-contract.md`.

## Merchant Standard: approved endpoint and cutoff decisions

`GET /api/merchant/analytics/standard/` derives its business only from the authenticated active merchant. Standard contains profile visits, whole-period distinct profile visitors, recorded SAVE events, current Pocket holders, current valid specialty support, published-review counts and reply management aggregates. Standard does not expose comparisons, prior-period boundaries, Premium metrics or personal explorer identities. Existing shared date helpers may compute prior bounds internally; those bounds are removed from every Standard metadata object and no prior-period query is performed.

Approved unanswered scope is **all current published reviews**, not just the selected cohort. Approved reply cutoff is the report's **generated_at**, not the selected period's end. The rate denominator is currently published reviews created in the selected [start,end) period; the numerator is those with a retained merchant reply created by generated_at and no earlier than the review. A reply after the selected period can count in today's report for that older review cohort. Empty denominator is null; no qualifying replies among eligible reviews is 0%. Include numerator, denominator and cutoff in the response for interpretation.

Current SQL snapshots exclude future creation timestamps for reviews, Pocket holdings, specialty links and vouches. Invalid/future reply timestamps are excluded and disclosed. Publication, evidence validity, specialty activity and reply retention are current-state decisions, not reconstructed history; subsequent moderation/deletion can change an earlier period's result. Per-specialty supporter counts cannot be summed into a business-wide distinct total. Valid suspicious evidence still follows the existing maintained evidence rules.

Merchant Plus enforcement is default-off for development previews; authentication, merchant role and ownership remain required on all Premium endpoints. When enforced, the unimplemented entitlement lookup fails closed with 403 `PLUS_REQUIRED`. Standard does not use the Plus permission and remains accessible. Premium routes are documented above; the real entitlement structure remains later work. No plan model or payments are introduced. See `sugbogo_backend/docs/merchant-analytics-api-contract.md` for Ralph's integration points and verification checklist.
