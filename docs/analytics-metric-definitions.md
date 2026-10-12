# Analytics metric definitions and shared foundation

This dictionary implements the definitions in `docs/analytics-plan.md` and the subsequently agreed Standard/Premium split. The repository is the implementation reference. Task 1 adds helpers and read-only aggregation only: no endpoints, entitlement checks, models, migrations, payment processing, new dependencies, or registered Django apps.

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

Specialty/review/SQL metric implementations are not added in Task 1; this dictionary establishes their meaning for subsequent tasks. Existing application approval, resubmission and SLA definitions remain unchanged. Discovery Score is an opportunity/credibility ranking signal, not satisfaction, measured exposure or revenue; do not alter its computation.

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
- Deferred: navigation-start analytics, conversion funnels, peer comparisons and historical specialty/score charts require later instrumentation, population definitions or retained history. Separate totals do not establish a conversion journey. Integrated payment processing remains excluded.

## Proposed indexes, not created

The existing visibility store already declares unique dedupe and `(event_type, business_id, occurred_at)` indexes on its write path. New read methods do not initialize them.

For later review using deployed query plans, consider `(occurred_at, event_type)` for bounded platform totals, `(business_id, occurred_at, event_type)` for scoped reports, and `(event_type, occurred_at)` for earliest-event lookups. These are candidates only: inspect existing deployed indexes, event volume and execution statistics before selecting or creating any. Mongo `$dateTrunc` requires server 5.0 or newer; confirm the deployed server before enabling series endpoints. No dependency/server upgrade is performed here.

## Verification scope

Tests cover Manila/UTC boundaries, default and custom periods, equal elapsed prior periods, daily/Monday-week grouping, clipped buckets, repeated explorers across dates/businesses/types, zero vs unavailable results, invalid scopes, source and cursor failures, cooldown recovery, first-observed events and metadata limitations. New service tests use in-memory fixtures and forbid index initialization; they do not require a real MongoDB service or create domain rows. A live Mongo compatibility/query-plan check is deferred until approved infrastructure validation.
