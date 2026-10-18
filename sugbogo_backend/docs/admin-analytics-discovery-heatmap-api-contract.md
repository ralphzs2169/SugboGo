# Admin discovery heatmap API and integration handoff

Branch: `feat/admin-analytics-discovery-heatmap`.
Implementation date: 16 October 2026 (Asia/Manila).
Verified local base: main `4a4048f75a157e0ebb18a000e50d5ebbcaac25f2` plus the five reused geographic foundation files and the heatmap implementation.

## Purpose and scope

Expose recorded business-profile visits at current business locations, grouped into the approved fixed 1 km Cebu City grid. The same aggregate cells support a map and an equivalent accessible table. This is listing engagement, not physical arrivals, tourist movement, audience residence, business quality, or revenue.

This branch adds a backend endpoint and its integration contract. Ralph owns the web interface connection. No merchant analytics or mobile screen is changed. No AI, recurring schedule, cache, scoring change, new dependency, Django app, geographic model, or migration is introduced.

## Reuse and main inspection

- Main was inspected at `723ffa4e`; merchant recommendation PR #148 had merged, but geographic foundation PR #150 had not.
- Main subsequently advanced to `4a4048f7`, merging duplicate review-migration fix PR #151. This removed `reviews/0022_merge_media_cleanup_policy.py` and retained `0022_merge_20261016_0400.py`.
- Foundation PR #150 contains the removed duplicate migration. Bringing its entire old branch into this base would restore that file. Reuse only its two geographic services, two tests, and contract unless its branch has first been reconciled with the migration fix. Review PR #150's migration diff before merging it.
- With explicit user approval, this local branch was fast-forwarded to `4a4048f7` and those five files were restored from `origin/feat/analytics-geographic-aggregation`. The redundant migration was excluded. Local development and verification do not depend on PR #150 being merged first. The copied foundation contract retains that earlier branch's historical verification/migration record; the current heatmap branch's migration and test state is recorded here.
- Geographic attribution, boundary validation, grid generation, exclusions, batching and reconciliation remain in `GeographicAggregationService` and `GeographicGridService`; the heatmap service does not reimplement them.
- `CoverageQuerySerializer` supplies taxonomy IDs and inherits `AnalyticsPeriodQuerySerializer` and the shared Manila date resolver. Existing `AnalyticsMetaSerializer`, `IsAuthenticated`, `HasRole`, and `success_response` are reused.
- The closest maintained API layout includes separate `operations_views.py`; this task similarly adds `discovery_heatmap_views.py`, rather than expanding unrelated views.

## Endpoint and authorization

`GET /api/admin/analytics/discovery-heatmap/`

Authentication uses the existing authenticated API client/JWT flow. Only active `ADMIN` and `SUPER_ADMIN` users may read the endpoint. Anonymous users receive 401; authenticated merchants, explorers, suspended admins and disabled admins receive 403. Permission checks run before geographic/visibility reads. POST, PUT, PATCH and DELETE are unsupported (405).

Successful reads use the standard envelope:

```json
{
  "success": true,
  "message": "Discovery heatmap retrieved successfully.",
  "data": {}
}
```

The `data` object is defined below. HTTP 200 acknowledges a retrieved report; inspect its source metadata and display state before drawing a heatmap. A controlled unavailable report remains a successful read with unknown measurements, rather than a fabricated zero-activity result. Invalid inputs use the existing 400 `VALIDATION_ERROR` envelope. Unexpected application/database failures retain existing error handling.

## Query parameters

| Parameter | Accepted values | Default/behavior |
| --- | --- | --- |
| `period` | `7`, `30`, `90`, `custom` | `30` |
| `start_date`, `end_date` | ISO `YYYY-MM-DD` | Required together for custom; disallowed with preset dates; ordered and not future |
| `cluster`, `category` | Positive existing taxonomy IDs | Optional; category must belong to cluster if both supplied |
| `metric` | `profile_visits` | Only initial supported metric |
| `cell` | Canonical ID returned in `cells[].id` | Optional geographic cell selection |

One reporting clock is captured by the inherited date resolver. Calendar dates use Asia/Manila; visibility reads receive effective UTC `[start, end)` bounds. A period including today ends at that clock and discloses a partial day. Historical periods still use current population and current business locations.

Unknown or repeated parameters are rejected. There is no pagination, arbitrary viewport/bounding-box filter, district filter, custom grid resolution, business/user ID, or unique-visitor metric. The fixed reporting area remains Cebu City. Cluster/category are taxonomy, not geographic districts.

Cell IDs must match the current grid version and canonical integer indices. A readable grid rejects cells outside its approved set with a 400 `cell` error. When geography is unavailable, a syntactically valid requested cell is retained in selection metadata, but membership and counts remain unknown; the server does not pretend it verified that cell.

Examples:

```text
/api/admin/analytics/discovery-heatmap/?period=30
/api/admin/analytics/discovery-heatmap/?period=7&cluster=1&category=2
/api/admin/analytics/discovery-heatmap/?period=custom&start_date=2026-10-01&end_date=2026-10-10
/api/admin/analytics/discovery-heatmap/?period=30&cell=cebu-utm51n-1000m-origin0-floor-v1:596:1139
```

Taxonomy IDs in examples are placeholders and must exist in the deployment.

## Response data

| Field | Meaning |
| --- | --- |
| `label`, `description` | Measurement labels suitable for the admin interface |
| `metric`, `measurement_type` | `profile_visits`, `period_current_state` |
| `display_state` | Whole displayed selection state; see below |
| `definition` | Grid version, EPSG:32651 projected CRS, 1,000 metre size, origin (0,0), floor/half-open assignment, output SRID 4326, longitude/latitude order, 10,000-cell bound |
| `scope` | Approved boundary identity, update timestamps, geometry/reference hashes and validation method; null when geography is unavailable |
| `cells` | Complete selected grid rows with full square GeoJSON geometry, or null when geography is unavailable |
| `attribution` | Current active population/current location disclosure; historical attribution may move; `physical_arrivals = false` |
| `reconciliation` | Full taxonomy-filtered inventory and assigned/excluded business/visit totals, including exclusion reasons |
| `sources` | Separate domain, geography and visibility metadata using the shared period/coverage/freshness contract |
| `meta` | Combined report metadata and limitations |
| `selection` | Requested cell, number of returned cells, total grid cells, displayed business/visit counts, and reconciliation scope |
| `legend` | Linear recorded-count scale over the full filtered geographic scope |
| `truncated`, `empty_cells_included` | False and true respectively for supported results; overflow fails explicitly instead of silently truncating |

Each `cells[]` row contains `id`, `column`, `row`, `geometry`, `eligible_businesses`, nullable `profile_visits`, `measurement_status`, and `state`. Geometry uses GeoJSON Polygon coordinates in `[longitude, latitude]` order; close rings are already supplied. Business/explorer identifiers and per-person observations are absent.

Cell `state` is one of:

| State | Interpretation |
| --- | --- |
| `no_businesses` | No eligible business assigned to this cell; population is known even if visibility is unavailable |
| `zero_recorded_visits` | Businesses exist and the source returned zero recorded visits |
| `recorded_visits` | Businesses exist and readable recorded visits exceed zero |
| `visibility_unavailable` | Businesses exist but recorded visit counts are unknown |

Whole-selection `display_state` uses those same states, plus `geography_unavailable` when `cells` is null. A known empty population takes precedence over visibility failure in the display state, while null visits and unavailable visibility metadata remain intact. Never replace nulls with zeros.

`selection.eligible_businesses` and `selection.profile_visits` describe only returned cells. In contrast, `reconciliation` always describes the **full filtered inventory**, including excluded locations; `selection.reconciliation_scope = full_filtered_inventory` makes this explicit. Without cell selection, cell visits reconcile to assigned visits and selected populations reconcile to assigned businesses. With a selected cell, other cells' counts remain in full-scope reconciliation and must not be presented as that cell's totals.

`legend.method = linear_count`, `unit = recorded_profile_visits`, and `scope = full_filtered_reporting_scope`. Its minimum is zero and maximum is the largest full-scope cell count when geography and visibility are readable. Cell selection keeps that same scale. `zero_range = true` identifies a healthy all-zero scale: avoid dividing by zero or coloring it as positive activity. When either required source is unavailable, minimum/maximum/zero-range are null. The backend supplies no new colors, threshold bands, popularity labels or design system.

The foundation continues to include empty cells, retain source-specific failures, validate boundary equality and keep half-open deterministic cell assignment. Read the [geographic contract](analytics-geographic-aggregation-contract.md) for exclusions, current-location caveats, capability checks and output bounds. Whole squares may cross the boundary; that does not expand eligible business membership or establish district polygons.

## Frontend connection for Ralph

Existing files inspected:

- `sugbogo_frontend/web_app/src/features/admin-panel/pages/Analytics.jsx` currently renders the Analytics heading after its overview request.
- `src/features/admin-panel/services/analyticsService.js` uses the existing authenticated client at `src/shared/api/apiClient.js`.
- Existing admin map components and `GoogleMapsProvider` already supply map integration patterns. Preserve their established design tokens/components and inspect their usage before UI changes.

Add a heatmap request alongside the existing overview method. Use the actual Axios envelope:

```javascript
const response = await apiClient.get("/admin/analytics/discovery-heatmap/", {
  params: { period: "30" },
  signal,
});
const report = response.data.data;
```

Use `cells` for both map geometry and table rows; no second table request is required. Display cell identity/indices, eligible businesses, recorded profile visits and measurement state in the table. Do not substitute barangay/district labels for grid coordinates. For map libraries expecting `{lat, lng}`, convert each pair explicitly; do not swap the API's GeoJSON order.

Reuse SugboGo's existing map, loading, feedback, table and theme patterns. Keep neutral no-business cells, readable zero-visit cells and unavailable measurements visually distinguishable using existing tokens. Provide a textual legend/table and accessible labels so color alone does not communicate the result.

Changing date/taxonomy selection should issue a new read and prevent an older response from overwriting it (cancel or ignore stale requests). Keep map/table tied to the same returned dataset and grid version. Client-side cell selection can preserve map context; the optional server `cell` filter supports a focused/deep-linked view. No polling, refresh POST, AI generation or automatic daily/monthly schedule is required.

Show reporting dates, current-location attribution, coverage/freshness limitations and per-source failures. Clear a prior successful heatmap when a different selection returns unavailable data. Handle 401 via the existing session flow, 403 as denied access, and 400 using the existing field-validation errors. Transport/server failures use existing error/retry feedback rather than a zero-filled map.

## Verification and integration status

Implementation, safe main update/five-file foundation reuse, and disposable-database verification were separately approved and completed. The local combined branch was tested without waiting for PR #150 to merge, and without restoring its retired migration file.

Executed commands, from `sugbogo_backend`:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.admin_operations.analytics apps.shared.analytics --noinput
& '..\.venv\Scripts\python.exe' -B manage.py check
& '..\.venv\Scripts\python.exe' -B manage.py makemigrations --check --dry-run
```

Results:

- **173 tests passed**, with 20.563 seconds of test execution (database setup/cleanup additional). The disposable database was destroyed successfully. This run includes geographic foundation, new heatmap service/API, existing admin analytics, and shared analytics tests; do not add earlier overlapping branch totals to it.
- `manage.py check`: no issues (0 silenced).
- `manage.py makemigrations --check --dry-run`: no changes detected. No migration was created for this feature and none was applied to the application database.
- Local diff whitespace check and production-function docstring checks passed.
- Heatmap tests cover inherited period/taxonomy validation, canonical and repeated query inputs, one-cell selection with full-scope reconciliation/legend, healthy zero/empty states, unavailable visibility/geography, standard serialization, active admin/super-admin access, denied roles/statuses/anonymous requests before data reads, unsupported methods, and aggregate-only output.

Tests use real disposable PostGIS, fixture visibility observations or mocked source reads. They do not establish live Mongo completeness, deployed HTTP behavior, frontend acceptance, concurrent-load performance or production readiness. No application migration, staging, commit, push, or GitHub PR creation is authorized by this contract. PR title/body will be supplied in chat for the user to edit and create manually when requested.
