# Admin overview and discovery analytics API

Task 2 (`feat/admin-analytics-discovery`) adds read-only admin reports on top of Task 1. No frontend screens, merchant endpoints, subscription logic, schema changes or indexes are added.

## Access and routes

Both endpoints require authentication and an active ADMIN or SUPER_ADMIN account under the existing `HasRole` rules. Explorers, merchants and inactive administrators cannot access them. Existing JWT, errors, throttling and `success_response` behavior remain in effect.

| Method and route | Purpose |
|---|---|
| `GET /api/admin/analytics/` | Platform overview KPIs plus weekly new-explorer registrations; replaces the placeholder response while retaining route name `get_analytics_data`. |
| `GET /api/admin/analytics/discovery-trend/` | One selectable discovery metric and daily/weekly sparse series. Route name: `admin-discovery-trend`. |

Existing Discovery Score list/recompute routes remain unchanged. These GET reports never recompute Discovery Score, create indexes, write tracking data, or invoke Gemini.

## Query parameters

| Parameter | Values and default |
|---|---|
| `period` | `7`, `30`, `90`, `custom`; default `30`. |
| `start_date`, `end_date` | Required together for `custom`, inclusive ISO dates. Rejected for presets. Future/reversed dates are rejected. |
| `metric` (trend only) | `impressions`, `profile_visits`, `saves`, `distinct_engaged_explorers`; default `profile_visits`. |
| `interval` (trend only) | `daily`, `weekly`; default `daily`. |

Unsupported query keys are rejected; business/category/cluster filtering is not introduced in this task. Invalid queries return HTTP 400 with the existing `success=false`, `code=VALIDATION_ERROR`, `message`, `errors` envelope.

Examples:

```text
/api/admin/analytics/?period=30
/api/admin/analytics/discovery-trend/?period=7&metric=profile_visits&interval=daily
/api/admin/analytics/discovery-trend/?period=custom&start_date=2026-10-05&end_date=2026-10-11&metric=distinct_engaged_explorers&interval=weekly
```

## Response envelope

```json
{
  "success": true,
  "message": "Platform analytics retrieved successfully.",
  "data": {
    "kpis": {},
    "new_explorer_accounts_weekly": [],
    "registration_series_is_sparse": true,
    "meta": {},
    "sources": {
      "domain": {},
      "visibility_current": {},
      "visibility_previous": {}
    }
  }
}
```

This illustrates structure; actual `kpis`, `meta` and source objects contain the fields documented below. Trend responses use message `Discovery trend retrieved successfully.` and the same outer envelope.

HTTP 200 means the report was constructed, not that all sources were available. Mongo failures are disclosed through metadata and null affected metrics so healthy SQL values can still be returned. SQL/unexpected programming failures are not caught and disguised as successful empty reports.

## Overview KPI definitions

Each of `active_businesses`, `approved_businesses`, `new_explorer_accounts`, `discovery_active_explorers` contains `label`, `description`, `measurement_type`, `value`, `previous_value`, `change`, and `source`. Snapshot metrics also include `as_of`.

| Key | Definition | Historical comparison |
|---|---|---|
| `active_businesses` | Current `Business.BUSN_STATUS=ACTIVE`; does not impose verification or owner-status filtering. | Null; `historical_snapshot_unavailable`. |
| `approved_businesses` | Existing business linked to a current APPROVED merchant application, including suspended businesses. Unlinked applications do not count. | Null; `historical_snapshot_unavailable`. |
| `new_explorer_accounts` | Current EXPLORER-role accounts created within the selected period, including pending/suspended/disabled accounts. | Count-based percentage change when prior value and samples permit it. |
| `discovery_active_explorers` | Distinct recorded explorer IDs across all supported visibility events and businesses in the period. Historical events are not filtered by current account/business state. | Null while tracking coverage remains unverified; `coverage_unverified` or `data_unavailable`. |

The approved-business choice supersedes the plan's verified-business KPI. Maintained approval creates active businesses without setting the legacy verified flag; Task 2 neither changes that flow nor backfills flags. This is a documented product/implementation difference.

Snapshot metrics ignore the selected event dates and measure inventory when queried; they are not active/approved counts at the historical period end. `new_explorer_accounts` has `measurement_type=period_current_state`, because later role changes/deletion can revise historical registration counts. Neither email verification nor account activation defines this cohort.

`new_explorer_accounts_weekly` contains observed Monday-start Manila buckets with `date`, clipped UTC `start`, `end_exclusive`, and `value`. It is sparse. The discovery KPI label and description explicitly say it is not total app MAU.

## Discovery trend fields

Trend `data` contains:

- `metric`, `label`, `description`, `measurement_type=period`.
- `value`: recorded current-period event total or period-wide distinct explorers; null if its read fails.
- `previous_value`: independent prior-period observation; null if its read fails.
- `change`: signed change/direction/unit/reason structure; no fabricated growth percentage.
- `interval`: `daily` or `weekly`.
- `series`: sparse list of observed `date`, clipped UTC `start`, `end_exclusive`, `value`; null if series reading fails. A healthy empty series is `[]`.
- `series_is_sparse=true`.
- `meta`, `sources.visibility_current`, `sources.visibility_previous`.

An explorer may appear on several chart points but only once in the period-wide distinct total. Do not add chart distinct counts to calculate the headline total. Event totals retain existing UTC-day deduplication even though charts group into Manila buckets.

Current total, current series and prior total reads are handled separately. A failed series read does not erase a successful total; a failed prior read does not erase current results. Source cooldown may cause subsequent reads to fail quickly until recovery.

## Metadata and comparisons

Metadata follows the shared foundation contract: period timezone/dates/effective bounds, `data_through`, `generated_at`, `availability`, `is_partial`, `partial_reason`, `partial_reasons`, `coverage_verified`.

- Domain metadata uses current retained SQL rows, a query cutoff and `current_state_reporting`; it does not claim immutable historical roles/statuses.
- Visibility metadata always has `coverage_verified=false` and unknown `data_through`. First/last events are not completeness watermarks.
- Recorded visibility values are displayed with partial/unverified-coverage disclosures. Comparisons are intentionally null until a later server-side coverage policy has reliable evidence. There is no request parameter for a client to assert coverage.
- A failed source returns unavailable metadata. If only some current reads fail, available results remain with partial metadata and read-specific reasons.
- A zero recorded count from a successful read is not null and does not prove there was no real-world activity.
- Registration percentages use immediately preceding equal elapsed periods. Zero prior count or insufficient observations yields null comparison.
- Rates elsewhere use percentage points; Task 2's implemented KPIs are counts, not approval or sentiment rates.

Overview-level metadata is partial when visibility completeness is unverified. Use `sources` and each KPI's `source` to avoid showing healthy domain metrics as unavailable. For a fully failed discovery report, `availability=unavailable`. Use all `partial_reasons`, not just the first reason.

## Frontend acceptance checklist

1. Read payloads from `response.data.data` when using the raw Axios response (or the equivalent existing wrapper); do not rely on the old placeholder message.
2. Keep snapshot cards visibly labeled current, with their `as_of`; period selection must not imply historical inventory snapshots.
3. Render `0` as zero recorded observations. Render null values as unavailable, never coerce them with `value || 0` or `value ?? 0`.
4. Render null comparisons as unavailable with their reason, never `0%` or a green growth badge.
5. Label discovery-active explorers as not total app MAU.
6. Show incomplete-day, coverage and freshness disclosures from metadata. Do not call unknown `data_through` "up to date".
7. Preserve successful current values when prior readings fail; preserve totals when series readings fail.
8. Treat sparse series as observed buckets. Do not automatically fill visibility gaps with zeros or draw a continuous line through unknown gaps. Healthy SQL registration gaps may be filled only under an explicit current-state display policy.
9. Keep SAVE events distinct from current Pocket holders; this task reports SAVE events, not current holders.
10. Support keyboard/touch-readable values and a table/list alternative within the established SugboGo design system.

## Backend and team verification

Automated coverage includes SQL model populations, approved versus verified semantics, role conversion, registration boundaries, empty prior counts, current/prior source failures, service aggregation, and endpoint permissions/validation/envelopes. SQL service tests use a disposable PostGIS test database; Mongo aggregation and API contract tests use mocks/in-memory fixtures.

Before rollout, infrastructure/backend owners must:

1. Confirm the deployed MongoDB supports `$dateTrunc` (5.0+) and test daily/Monday-week grouping on approved development/staging data.
2. Reconcile event totals and distincts using identical UTC bounds; verify inclusive start/exclusive end and Manila midnight.
3. Inspect existing indexes and representative `explain("executionStats")` results without creating indexes. Record scope, date range, document volume and latency.
4. Verify tracking start/retention and known outages separately from first-observed timestamps. Keep coverage unverified until trustworthy evidence exists.
5. Exercise authenticated admin/super-admin requests and rejected merchant/explorer/anonymous requests in a deployed test environment.
6. Test frontend scenarios: healthy zero, partial coverage, null total, null series, missing prior period and unsupported snapshot comparison.

No live MongoDB verification or database/index changes are implied by passing mocked tests. Exact validation commands and observed results should be recorded in the PR after approved execution.
