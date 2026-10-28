# SugboGo Admin Analytics

The merchant application analytics module provides the aggregate metrics, weekly trends, and daily KPI history used by the admin dashboard.

The analytics are intentionally based on the application's domain model rather than treating every review, submission, and application as interchangeable. Resubmissions are handled as separate submission/review events where the metric represents workflow activity, while application-level rates avoid double-counting the same application when appropriate.

## Metric Definitions

| Metric | Definition | Counting Rule |
|---|---|---|
| **Pending Review** | Applications currently awaiting administrator review. | Counts applications whose current status is `SUBMITTED`. |
| **Approved** | Applications currently approved. | Counts applications whose current status is `APPROVED`. |
| **Rejected** | Applications currently rejected. | Counts applications whose current status is `REJECTED`. |
| **Total Applications** | Applications included in the reviewable application population. | Counts applications with status `SUBMITTED`, `APPROVED`, or `REJECTED`. |
| **Approval Rate** | Percentage of decided applications that are approved. | Each application is counted once using its current final status. Draft and submitted applications are excluded. |
| **Resubmission Rate** | Percentage of rejected applications that have been resubmitted. | At an exclusive cutoff, count applications with a recorded rejection; the numerator contains those with a submission strictly after a rejection of that same application and before the cutoff. Each application counts once, including later-approved applications. Submission counters do not establish chronology. |
| **SLA Compliance Rate** | Percentage of completed review events resolved within the configured review SLA. | Each classified persisted review result is counted independently. Unknown/null results are excluded from the percentage denominator. |
| **Pending Review This Week** | Number of application submissions that entered the administrator review queue during the current week. | Each submission is counted independently, so resubmissions are included separately. |

## Weekly Trends

Weekly trends compare the current week with the equivalent elapsed portion of the previous week.

The configured native timezone remains UTC. Approval and SLA trend queries use half-open timestamp windows from Monday midnight to the captured current time, and the preceding Monday to the same elapsed time one week earlier. A current Wednesday 10:30 cutoff therefore compares with the prior Wednesday 10:30, excluding observations exactly at either end.

`get_weekly_analytics_periods()` retains inclusive calendar labels for workload counts and legacy metadata only. It is not used for trend query bounds. `comparison_meta.bounds` exposes the exact timestamp windows; the existing trend object shape remains unchanged.

### Trend Output

```text
{
    "value": <absolute change>,
    "direction": "up" | "down" | "unchanged",
    "unit": "count" | "percentage_points",
}
```

Rate-based trends use **percentage points**, not relative percentage change.

A trend is not returned when either comparison sample is below the versioned `onboarding_comparison_min_sample` analytics policy. SLA sample sizes contain classified outcomes only.

## Approval Rate Trend

The approval-rate trend evaluates approval and rejection reviews within each period.

Each application is counted once per period using its latest review in that period. This prevents an application that was rejected and later approved from contributing multiple times to the same period's approval-rate denominator.

## Resubmission Rate Trend

A resubmission is a submission recorded strictly after a rejection of the same application. Equal timestamps do not prove ordering. Every qualifying submission is an event, but the rate counts applications once rather than counting repeated cycles.

The headline, weekly trend and daily history use the same cumulative rejection-recovery definition:

- Denominator: applications with a recorded rejection before the cutoff.
- Numerator: those applications with at least one submission strictly after a rejection and before the same cutoff.
- No rejected applications: `null`; rejected applications without recovery: measured `0%`.
- Later approval does not remove an application from either cohort.

The headline cutoff is now. The weekly trend compares this cumulative rate with the same time one week earlier, in percentage points. This is a recovery snapshot comparison, not a count of this week's resubmission events. Daily history evaluates the same formula at each exclusive next-midnight cutoff, with today capped at now. `comparison_meta.resubmission_basis` and `resubmission_definition` disclose this corrected meaning.

Existing field names are retained. The old same-period rejection/submission trend and reviewed-that-day history definitions are intentionally corrected; historical outputs may change. Missing older rejection/submission records cannot be inferred from `MAPP_SUBMISSION_COUNT`.

## SLA Compliance

The configured merchant application review SLA is defined in `apps.merchant_application.constants`.

The analytics service consumes:

- `APPLICATION_REVIEW_SLA_BUSINESS_DAYS`
- `APPLICATION_REVIEW_SLA_APPROACHING_BUSINESS_DAYS`

The actual compliance result is persisted on each `MerchantApplicationReview` as `MAREV_SLA_COMPLIANT`.

This means historical analytics do not need to recalculate the SLA later.

### Review Event Independence

SLA analytics treat each completed review as an independent event.

For example:

```text
Submission #1 → Rejected → SLA result #1
Submission #2 → Approved → SLA result #2
```

Both review events contribute independently to SLA analytics.

This is important because a resubmitted application can have a different review turnaround time for each submission.

### SLA Trend and History

SLA trend and daily history only use completed reviews that:

- have a linked submission,
- have a persisted `MAREV_SLA_COMPLIANT` result, and
- have a review timestamp within the requested period.

The overall SLA compliance rate uses persisted non-null SLA results directly, including known legacy outcomes without a submission link. Trend/history retain their linked-submission population. All three use the same classified denominator: compliant / (compliant + non-compliant).

Unknown SLA outcomes are excluded from the numerator, denominator and comparison sample. The shared `get_sla_outcomes()` calculation retains an `unknown` count for callers/tests; the existing public rate payload has no separate unknown-count field, and none is invented. With no classified outcomes, rates remain `null`.

## Daily KPI History

The dashboard sparklines use the most recent **7 calendar days**, including today.

Each history entry has this structure:

```text
{
    "date": "YYYY-MM-DD",
    "value": <number> | null,
}
```

A `null` value means no applicable denominator/observation was available at that date or cutoff. It is intentionally preserved rather than converted to zero.

### Pending Review History

At each historical date, a submission is considered pending when:

1. It was submitted on or before that date.
2. It had not received a review by that date.

Submissions are evaluated independently, so resubmissions are represented as separate pending submission events.

### Approval Rate History

For each day:

- Only approval and rejection reviews from that day are considered.
- Each application is counted once using its latest review for that day.

This prevents multiple review events for the same application from inflating the daily approval-rate denominator.

### Resubmission Rate History

For each date, evaluate the same cumulative rejection-recovery rate at the exclusive next midnight, capped at now for today. Later submissions and rejections cannot alter an earlier cutoff's result. The final point agrees with the headline when evaluated with the same captured clock.

### SLA Compliance History

For each day:

- Completed review events are grouped by review date.
- Each review contributes its persisted SLA-compliance result independently.

Resubmission reviews therefore contribute separately to the daily SLA rate.

## Application Population

The aggregate application statistics use the following reviewable statuses:

```text
SUBMITTED
APPROVED
REJECTED
```

Draft applications are excluded from the reviewable application population.

## Empty and Insufficient Data

Analytics methods avoid inventing values when there is no meaningful data.

Depending on the metric:

- A rate with no denominator returns `null`.
- A daily history point with no observations returns `null`.
- A weekly trend returns `null` when either comparison period has insufficient observations.
- Pending-review counts can legitimately be `0`.

The frontend can therefore distinguish between:

```text
0     → there were zero observations/counts
null  → there was not enough applicable data to calculate the metric
```

## Dashboard Usage

`get_application_statistics()` is the main aggregation entry point for the admin application statistics endpoint.

It returns:

- application counts,
- current KPI rates,
- weekly trends,
- pending-review activity for the current week,
- seven-day KPI histories, and
- the configured review SLA thresholds.

The frontend uses these values for the Merchant Applications dashboard KPI cards, trend indicators, sparklines, and SLA information panel. Failed statistics requests show a persistent section error and Retry using the hook's `refetch()`, never a default zero. Sparklines retain null buckets and use Recharts gaps (`connectNulls=false`); measured zeroes remain observations.

## Tests

Analytics tests are located under:

```text
apps/admin_operations/analytics/tests/
```

The tests cover aggregate metrics, weekly trends, historical KPI values, SLA behavior, sample-size protection, and resubmission handling.

When changing an analytics definition, update the corresponding tests and this README together so the documented business meaning remains aligned with the implementation.


## Persisted-data reporting expansion (Phase 2)

The existing overview, discovery, score, coverage, geography and Phase 1 application contracts remain supported. Four focused SQL reports are added; selected-period processing metrics extend onboarding rather than creating separate turnaround/rejection endpoints. No event tracking, Mongo collections, migrations, indexes, caches or rollups are introduced.

| GET route under `/api/admin/analytics/` | Responsibility |
|---|---|
| `platform-growth/` | Current consumer/business inventory; account/business creation and first recorded linked-business approvals |
| `community-health/` | Current review states; currently published creation cohorts and stored sentiment |
| `specialty-support/` | Current valid specialty support, global distinct supporters/businesses and ranked tags |
| `change-requests/` | Current name/classification/location backlog, resolution-period outcomes and administrator turnaround |
| `onboarding/` (extended) | Adds selected-period `review_turnaround`, `rejection_insights`, `processing_meta` |

All use authenticated active Admin/Super Admin permissions, explicit output serializers and `success_response()`. Inputs reuse `AnalyticsPeriodQuerySerializer`: `period=7|30|90|custom` (default 30), inclusive ISO custom dates, Manila boundaries translated to half-open UTC timestamps, capped at one captured now. Growth/community additionally accept `interval=daily|weekly` (default daily). Unsupported inputs are rejected. Specialty support accepts the common period context but explicitly reports a current snapshot; selected dates do not filter its evidence.

### Growth definitions

- Consumer accounts are retained accounts whose **current** role is Explorer or Merchant, excluding Admin/Super Admin roles, `is_staff=True` and `is_superuser=True`. All account statuses are included. Current Explorer/Merchant subtotals describe roles, not mutually exclusive product capabilities.
- Consumer creation cohorts use `USER_CREATED_AT` and those same current-role/staff rules. Role/staff changes or account deletion can revise historical cohorts. Explorer-to-Merchant promotion keeps an account in the consumer union; no historical role is invented.
- Business inventory uses all retained businesses, separately counting active and suspended status. Business creation uses `BUSN_CREATED_AT`, independent of current status.
- Newly approved businesses use each application's earliest **recorded** approved `MerchantApplicationReview`, provided the application is currently linked to a business. Timestamp ties use review ID. Repeated approvals count once, even across report periods. Unlinked approvals and missing decision times cannot establish a business approval. Current application/business status and current Merchant-role counts do not define this measure.
- Inventory is a `current_snapshot` with `as_of` and `selected_period_applies=false`; it has no invented historical comparison.
- Activity comparisons are **absolute count differences**, using the existing `compare_count_difference()` over adjacent equal-elapsed windows. Zero is a valid count; no percentage division is required.
- Daily/weekly series are SQL-grouped by Manila calendar, clipped to the selected interval and zero-filled. Weekly dates label Monday; a clipped bucket can start later. They are not sparse.

### Application processing definitions

`review_turnaround` selects approved/rejected review events by `MAREV_REVIEWED_AT` in `[start, end)`. It measures elapsed hours from `MASUB_ID.MASUB_SUBMITTED_AT` to that review's timestamp. Each submission/review cycle contributes independently; application creation time, latest submission time and SLA classification are not substituted.

`candidate_count = sample_count + excluded_count`. Exclusions are mutually exclusive, in this order:

1. `missing_timestamp_count`: missing submission link/start or missing end.
2. `unrelated_record_count`: linked submission belongs to a different application.
3. `invalid_chronology_count`: decision precedes submission.

Zero-hour durations are valid. Median/mean are hours rounded to two decimals; both are null with no valid sample. `missing_decision_timestamp_count` is a separate all-dates diagnostic because records without a decision time cannot enter a selected decision period. Current timestamp columns are non-null, but the legacy submission link is nullable. These diagnostics do not reconstruct missing historical events.

`rejection_insights` counts selected rejected **review decisions**, not raw feedback records. For each actual `MerchantApplicationFeedback.Section` value (identity, location, operating_hours, photos, documents):

- `rejection_decisions`: distinct review IDs carrying that section.
- `distinct_applications`: distinct affected application IDs.
- `decision_share_percentage`: section decisions / all selected rejected decisions.
- `application_share_percentage`: affected applications / all selected rejected applications.

Repeated feedback rows do not inflate counts. Repeated application rejections can increase decision counts but not section-level distinct applications. Multiple sections can apply to one decision, so shares can sum above 100%; they are not a disjoint composition. Empty denominators yield null shares. Decisions without recognized section feedback and decisions containing unrecognized legacy section values are separately disclosed. No free-text rejection taxonomy is inferred.

The new processing metrics use the selected Manila period and `processing_meta`. `legacy_statistics`, Phase 1 SLA/resubmission semantics, native UTC comparisons and current pending aging remain intact.

### Community health definitions

Current inventory reports retained reviews and each persisted moderation status as of generation time. Period activity counts `REVW_CREATED_AT` cohorts that are **currently published**, across all retained business statuses. It is not publication-transition history: later rejection, deletion, edits or classification changes can revise historical results.

Sentiment matches Merchant Analytics: recognized stored positive/neutral/negative labels contribute, including when a numeric sentiment score is absent. `classified_review_count` is their pooled sum. Null/unrecognized labels are `unclassified_review_count` and stay outside the classified share denominator. Shares are descriptive, not statistical conclusions or model-accuracy estimates. No ratings/stars are created. The report includes current/prior cohorts, an absolute published-count comparison and zero-filled daily/weekly cohort/sentiment series.

### Specialty support definitions

The report matches maintained VouchService evidence validity: non-withdrawn, valid vouches on a currently active business/tag assignment, with evidence/assignment creation no later than `as_of`. Suspicion alone does not invalidate evidence. All retained business/account statuses are included, matching merchant-owned support reads; the report does not silently impose the active-business coverage population.

- `valid_vouches`: endorsement records.
- `distinct_supporters`: distinct accounts across every eligible endorsement.
- `supported_businesses`: distinct businesses across every eligible endorsement.
- `supported_specialties`: distinct tags receiving eligible evidence.

Global people/business counts are aggregated directly, never summed from per-tag counts. A person supporting two tags gives two endorsements but one global supporter. Each supported tag includes ID/name, endorsements, distinct supporters and distinct supported businesses. Rows sort by endorsement count descending, distinct supporters descending, then tag ID. `top_supported_specialties` contains the first 10; `specialties` contains all supported tags. Zero-support tags are omitted. This is current evidence, without selected-period filtering or invented historical growth.

### Change-request definitions

Only persisted listing-change types are included: `BusinessNameChangeRequest`, `BusinessClassificationChangeRequest`, `BusinessLocationChangeRequest`. Each has pending/approved/rejected/withdrawn statuses and submitted/resolved timestamps.

Backlog counts current pending requests regardless of selected dates. Aging uses the existing elapsed-hour conventions: under 24, 24 to under 72, 72+, and unknown for missing/future submission timestamps. `backlog_meta` marks the current snapshot.

`period_outcomes` uses terminal status and resolved time in the selected `[start, end)`. Approved/rejected outcomes represent administrator decisions; withdrawn is a separate merchant outcome. Withdrawals never enter administrator turnaround. Durations use submitted-to-resolved times, exclude missing/negative chronology and preserve valid zero durations. Global median/mean use all individual samples, never averages of type medians. Missing terminal resolution times are disclosed across all dates and are not assigned to the selected period or added to its candidate count.

### Query behavior and limits

Focused query-count tests establish growth 8, community 3, specialty 2, change requests 9 (three per fixed request type), and application processing 4 additional queries. These counts do not grow per business, tag or chart day. SQL performs count/group/distinct/Exists operations. Python fills calendar buckets and calculates durations using projected timestamp columns rather than full ORM rows.

Exact medians currently buffer selected duration samples, following existing operational reporting practice. Broad date ranges, first-approval anti-Exists queries, whole-population distinct evidence and cohort scans require representative production query-plan/latency evaluation later. No speculative index, cache, Celery rollup or storage change is included. Large specialty inventories may eventually need pagination. Existing custom-date limits are unchanged.


## Discovery Activity acquisition and timeline contract

The independent `discovery-summary/` report exposes recorded profile visits, impressions
and saves through one existing visibility totals aggregation. It uses the shared reporting
period, permissions, metadata and response envelope. Zero is a successful recorded count;
null is an unavailable source. Event deduplication and MongoDB ingestion are unchanged.

The selectable `discovery-trend/` keeps its sparse legacy series and adds a nullable,
complete calendar `timeline`. Missing rows are not measured zeroes, and the last event is
not a data-through watermark. The dashboard uses the effective reporting bounds for its
axis and keeps null gaps in both line and area. Only a backend current-time-capped final
bucket is in progress; historical clipped weeks are not. A known early source cutoff can
be marked separately; current freshness remains explicitly unknown.

Comparisons stay suppressed while discovery tracking coverage is unverified. Three
selectable MetricCards drive one trend request; the summary query is independent and
unchanged by metric/interval selection. Details and exact nullable buckets use the shared
right-side drawer. No conversion, MAU, retention or new tracking metric is introduced.
See `docs/admin-analytics-api-contract.md` for fields and performance boundaries.
