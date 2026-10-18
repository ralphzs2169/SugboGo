# Merchant engagement heatmap API and frontend handoff

Branch: `feat/merchant-analytics-engagement-heatmap`.
Base inspected: main `b26a058f` on 16 October 2026 (Asia/Manila).
Scope: the backend portion of roadmap item 9 / decision D6 in `docs/analytics-scope-traceability.md`.

## Purpose

Show the authenticated merchant's recorded business-profile visits grouped by Manila weekday and hour. The output supplies a 7-by-24 matrix and equivalent table rows. It measures recorded attention to the listing, not customer arrivals, audience residence, every interaction, or recommended opening hours.

This is a temporal merchant heatmap, separate from the geographic admin heatmap. It needs no Google Maps overlay or explorer location collection. The branch adds the API, service, tests, and integration contract; no frontend screen is included.

## Existing code reused

- `PremiumAnalyticsView`: authentication, merchant role, server-side Plus gate, query/response flow and standard success envelope.
- `BusinessProfileService.get_business_for_merchant`: existing owned-business query and not-found handling. Client-supplied business/user IDs are rejected.
- `StandardAnalyticsQuerySerializer` and `resolve_period`: approved date selections, one reporting clock, Manila reporting dates, UTC half-open bounds.
- `VisibilityEventService._analytics_match`, `_analytics_window`, and `_read_analytics`: explicit business/event scope, window validation, read-only Mongo aggregation, outage/cooldown handling and no index creation during reads.
- `PremiumReportSerializer`, `owned_business_data`, and `build_meta`: owned-business response and maintained metadata conventions.
- Existing merchant fixtures and read-only Mongo evaluator, extended only for weekday/hour operators.

No existing visibility event writer, deduplication policy, Standard analytics payload, recommendation generation, scoring calculation, entitlement policy, or geographic grid is changed.

## Endpoint and access

`GET /api/merchant/analytics/premium/engagement-heatmap/`

The existing Premium permissions apply in order: authenticated user, active merchant role, effective server-side Merchant Plus access. Ownership is derived after those checks. Preview mode and authorized demo/mock entitlement behavior remain exactly as implemented by the existing gate; this feature does not bypass or redefine them.

- 401: unauthenticated.
- 403: role/account denial, or existing `PLUS_REQUIRED` when entitlement enforcement denies access.
- 404: no business owned by the caller.
- 400: invalid or unsupported query parameters, using the existing validation envelope.
- 405: POST, PUT, PATCH and DELETE are unsupported.

Successful report retrieval uses the existing Premium envelope and message:

```json
{
  "success": true,
  "message": "Merchant Premium analytics retrieved successfully.",
  "data": {}
}
```

`data` is described below. HTTP 200 can contain an unavailable visibility report; inspect metadata, states, and nullable counts.

## Parameters and examples

| Parameter | Accepted values | Behavior |
| --- | --- | --- |
| `period` | `7`, `30`, `90`, `custom` | Defaults to `30` |
| `start_date`, `end_date` | ISO `YYYY-MM-DD` | Required for custom; cannot accompany a preset; dates must be ordered and not future |
| `metric` | `profile_visits` | Defaults to the only approved metric |

Unknown and repeated query parameters are rejected. Do not send business/user IDs, Plus flags, arbitrary timezone, interval, visitor identifiers or client-defined thresholds. There is no pagination or metric selection beyond recorded profile visits in this release.

```text
/api/merchant/analytics/premium/engagement-heatmap/?period=30
/api/merchant/analytics/premium/engagement-heatmap/?period=7
/api/merchant/analytics/premium/engagement-heatmap/?period=custom&start_date=2026-10-01&end_date=2026-10-12
```

Manila calendar date selections become UTC `[start, end)` bounds through the existing shared helper. Today is clipped at the captured reporting clock and disclosed as a partial day.

## Measurement and deduplication

The new `get_profile_visit_timing` read helper performs one explicit business-scoped, PROFILE_VISIT-only Mongo aggregation. It groups recorded timestamps with `$isoDayOfWeek` and `$hour`, both explicitly using `Asia/Manila`, and returns at most 168 aggregate groups. It never returns raw event documents or explorer identifiers.

The implementation follows the official [ISO weekday](https://www.mongodb.com/docs/manual/reference/operator/aggregation/isodayofweek/) and [hour](https://www.mongodb.com/docs/manual/reference/operator/aggregation/hour/) operator definitions. Live Mongo compatibility remains a deployment verification item; automated tests evaluate the pipeline through fixture observations.

The existing writer deduplicates by explorer, business, event type and UTC day, retaining the first successfully stored event timestamp with `$setOnInsert`. Later visits to the same listing during that UTC day do not add another PROFILE_VISIT document. This heatmap therefore describes **recorded visit timing under that policy**, not all visits or each interaction's hour. The writer and deduplication were not changed.

Different weekdays/hours can have different numbers of calendar occurrences in the selected period. Counts are raw totals, not normalized hourly rates. Partial hours and unverified collection coverage further limit comparisons. The output provides sample context but no best-hour ranking, automatic confidence threshold, causal explanation or opening-hours recommendation.

## Response fields

| Field | Meaning |
| --- | --- |
| `business` | Only the caller's owned business identity, name and current status |
| `label`, `metric` | Recorded profile-visit timing; `profile_visits` |
| `timezone`, `grid_version` | `Asia/Manila`, `manila-weekday-hour-v1` |
| `weekdays` | Ordered ISO weekday IDs 1–7, Monday–Sunday, with labels |
| `hours` | Ordered hour IDs 0–23 |
| `cells` | Exactly 168 ordered weekday/hour aggregate rows |
| `total_profile_visits` | Sum of the same scoped aggregation, null if unavailable |
| `display_state` | `recorded_visits`, `zero_recorded_visits`, or `visibility_unavailable` |
| `sample` | Nonzero/in-period/outside-period cell counts; conclusions remain unavailable without an approved inference policy |
| `legend` | Linear count scale; null when visibility is unavailable |
| `deduplication`, `measurement_note` | Explicit event-timing limitations |
| `period_occurrences_note` | Distinguishes selected calendar time from tracking coverage and opening hours |
| `sources.visibility`, `meta` | Maintained source/period/freshness/coverage metadata |

Each cell has stable `id = weekday:hour`, `weekday`, `hour`, nullable `profile_visits`, `state`, `period_occurrences`, and `includes_partial_hour`. Weekdays use Monday=1 and Sunday=7; hour 0 means 00:00–01:00 Manila time. The final hour ends at midnight of the following day.

`period_occurrences` counts calendar occurrences of that weekday/hour that overlap the effective selection. A partial final hour counts as one occurrence; it is not a full-hour equivalent. `includes_partial_hour` means at least one contributing occurrence is the clipped final partial hour. These fields do not assert that tracking was active, the business existed throughout the period, or the business was open then.

The service computes calendar slots using complete-week arithmetic and at most six remaining complete days plus the final date. Output and calendar work stay bounded even for long custom date ranges. The shared resolver supplies midnight-starting Manila reporting periods.

| Cell state | Count | Meaning |
| --- | --- | --- |
| `recorded_visits` | Positive integer | Readable recorded visits in this selected slot |
| `zero_recorded_visits` | 0 | Slot occurs in the selected period; readable source returned no visits for it |
| `outside_period` | null | Slot does not occur in the effective selected window |
| `visibility_unavailable` | null | Slot occurs in the window, but its source cannot be read |

An omitted group from a successfully completed aggregation means zero recorded events only for a slot that occurs in the selected period. That is not proof of complete collection. A failed read never becomes zeros. Even when the source fails, the 168-slot calendar layout remains available, with null counts and applicable states.

When visibility is readable, the sum of non-null cell counts equals `total_profile_visits`. Both come from one aggregation, so there is no separate total read that can diverge. Visitor uniques are not calculated or added across buckets. There is no prior-period growth calculation in this release.

`sample.nonzero_cells` is null on failure. `sample.conclusions_available` is false with reason `no_approved_timing_inference_policy`. Show sparse count context and measurement limitations; no new numeric suppression/confidence rule is introduced.

`legend.method = linear_count`. On readable data, the minimum is zero and maximum is the largest observed cell count. `zero_range` is true for a healthy empty result; avoid dividing by zero or drawing positive activity. On failure, minimum, maximum and zero-range are all null. The backend does not define a new color scheme.

## Frontend coordination for Ralph

1. Use the existing authenticated merchant API client and effective Plus-access presentation. The backend remains authoritative about access and ownership.
2. Fetch this endpoint for the selected reporting dates. Unwrap the standard success envelope's `data`; with raw Axios this is `response.data.data`.
3. Render a weekday/hour matrix using the returned axes and cells. Reuse SugboGo's established components, spacing, typography, colors and feedback patterns. No Google Maps component is needed.
4. Use the same cells for an accessible table/list or cell details: weekday, hour interval, recorded visits, selected calendar occurrences, partial-hour flag and measurement state. Provide textual labels so shading alone does not convey counts.
5. Keep zero recorded visits, outside-period slots and unavailable observations distinguishable. Never replace nulls with zero. For outside-period slots, say that the slot is outside the effective selection; do not label them as missing collection.
6. Show the period, timezone, sample context, collection limitations and daily-deduplication note. Do not label the strongest color as the best opening time or expected foot traffic.
7. On date changes, refetch and cancel or ignore older requests. Avoid keeping the prior selection's matrix visible as the new selection's result. A source failure may arrive in an HTTP 200 report; handle its state rather than displaying fabricated empty activity.
8. Handle session/access/validation/network errors through existing app patterns. No refresh POST, AI call, polling, background job or recurring daily/monthly schedule is required.

This branch provides backend support only. Frontend/native acceptance requires implementation and review in the frontend workflow.

## Local integration and migrations

Main `b26a058f` had restored `reviews/0022_merge_media_cleanup_policy.py` after the earlier duplicate-migration removal. With explicit user approval, `0023_merge_review_0022_heads.py` joins both 0022 heads with `operations = []`. Both existing migration files and their applied histories are preserved. No schema or application-data operation is added.

Only the disposable test database may apply that join under the granted verification approval. Application migration/deployment is not authorized. Reconcile any later concurrent migration repair before integration rather than deleting an applied migration or adding overlapping fixes blindly.

## Verification record

Executed from `sugbogo_backend`:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.merchant_operations.merchant_analytics apps.business.services.tests.test_visibility_analytics_service apps.shared.analytics --noinput
& '..\.venv\Scripts\python.exe' -B manage.py check
& '..\.venv\Scripts\python.exe' -B manage.py makemigrations --check --dry-run
```

- **214 tests passed**, with 27.203 seconds of test execution (database setup/cleanup additional). Disposable test database cleanup completed.
- Django checks: no issues (0 silenced).
- Migration dry-run: no model changes detected. The approved empty migration is graph repair only.
- The combined run includes merchant regressions, entitlement/ownership behavior, the new timing service/API, visibility reads and shared analytics. Do not add earlier overlapping branch totals to this result.
- Failure-path tests intentionally raise simulated Mongo outages; their logged exceptions are expected and the tests passed.
- Tests use real disposable PostgreSQL/PostGIS and fixture Mongo aggregation or mocked reads. They do not certify live Mongo execution, collection completeness, frontend/native behavior, deployment readiness or production-load performance.

No application data, dependency, app, tracking writer, Standard response, frontend screen or AI generation was changed. Work is local and unstaged at this verification checkpoint. No commit, push or GitHub PR creation is authorized by this implementation task; PR title/body will be supplied in chat when requested.
