# Geographic analytics foundation contract

Branch: `feat/analytics-geographic-aggregation`.
Inspection and approval date: 16 October 2026 (Asia/Manila).
Initial base: main `84b7fca7d02c4b0e8e3e98f21f7a6909fe4793bd`.
Implementation base: safely fast-forwarded with user approval to main `a50b118cdfa52026643d6297cfaa8b6c3bd4f161`.

## Approval and implementation state

The user first approved this branch and contract, including **1 km square cells**, then separately approved implementation file edits, disposable-database verification, and creation of the existing empty review merge migration. The geographic foundation is now implemented as internal services and focused tests. No endpoint, UI, new model, dependency installation, application-data write, staging, commit, or push is included.

The 1 km resolution is a product choice, not a statistically established threshold or a guarantee of anonymity. Implementation uses EPSG:32651 (WGS 84 / UTM zone 51N), fixed origin (0, 0), and floor assignment. No additional numeric suppression rule is approved here.

This task implements the foundation for roadmap item 7. The next admin discovery heatmap task will consume it. The approved direction is [D7 in the scope record](../../docs/analytics-scope-traceability.md): recorded activity aggregated at business locations, with current-location limitations, validated geographic scope, and no explorer-movement or physical-arrival claims.

## Purpose

Define one consistent way to assign currently eligible businesses to geographic cells and aggregate recorded profile visits. Subsequent heatmaps, table equivalents, and geographic reports should share these definitions instead of independently grouping coordinates.

Keep authoritative calculations deterministic. Do not call AI, alter Discovery Score, infer causes or business quality, or treat engagement with a listing as a customer arrival. Grid cells are analytical areas, not barangays, districts, clusters, or categories.

## Existing implementation to reuse

| Source | Existing responsibility |
| --- | --- |
| `apps/business/models/business_location_models.py` | `Location.LOCT_POINT` is a required point in SRID 4326; `ServiceableBoundary` stores active multipolygons in SRID 4326. |
| `apps/business/services/serviceable_boundary_service.py` | Service-area checks use `covers`, including boundary edges; active extent is available. |
| `apps/admin_operations/analytics/services/business_attention_service.py` | Current active business population, validated cluster/category filters, explicit business-ID visibility scope, source availability. |
| `apps/business/services/visibility_event_service.py` | Read-only, half-open-window business-keyed profile visits; existing UTC-day write deduplication. |
| `apps/shared/analytics/date_ranges.py` and `metadata.py` | Manila reporting periods, effective UTC bounds, one reporting clock, and partial/unavailable metadata. |
| `apps/explorer_operations/explore_businesses/services/map_discovery_service.py` | Nearby spatial-query conventions; public viewport markers remain a separate feature. |

Reuse existing service/serializer/view layering, uppercase model conventions if persistence is later justified, `HasRole`, and standard response envelopes. Do not change existing endpoint definitions to accommodate this foundation.

## Reporting population and geographic scope

1. Start from the same **currently active business inventory** and validated cluster/category filters as admin attention/coverage services. Do not add `BUSN_IS_VERIFIED`, Premium entitlement, hidden-gem status, or score requirements.
2. Geographic assignment additionally requires a usable business point covered by the explicitly approved reporting boundary set.
3. Initial reporting scope is **Cebu City**. Do not silently include every active service-area row if those rows expand coverage to other cities. Verify and identify the actual intended active boundary records before implementation acceptance.
4. The repository has a Cebu City multipolygon dataset whose metadata states `v03`, `valid_on=2025-02-13`. The loader describes OCHA/PSA COD-AB provenance. Source metadata does not establish that the application database loaded the same polygon or that it is the latest authoritative boundary.
5. `JOURNEY_ORIGIN_SEARCH_AREA` is a Metro Cebu search-relevance rectangle. Its comments explicitly distinguish it from an administrative/service boundary. It must not define analytics scope.
6. City/address/barangay strings are descriptive labels, not authoritative spatial membership. District or barangay reporting needs separately validated polygons or mapping.
7. Current inventory and classification do not reconstruct historical active-business populations. A historical date selection still uses the disclosed current population and locations.

If the required boundary is missing, inactive, unreadable, empty, invalid, or otherwise unverified for the intended scope, geography is unavailable. Do not substitute the search rectangle, a bounding box, an arbitrary city-name match, or an empty successful map. Healthy inventory/source results may still be disclosed separately.

## Grid definition

- Approved initial cell edge length: **1,000 metres**.
- Use one suitable projected coordinate system with metre units for Cebu City; verify the exact CRS and runtime transformation support before implementation. Do not calculate kilometre cells by rounding longitude/latitude degrees.
- Keep stored source points in SRID 4326. Transform derived coordinates for assignment; do not rewrite location rows.
- Anchor the lattice to one fixed origin in the chosen projected CRS. Do not shift it with viewport bounds, query filters, observed business extents, or reporting dates.
- Identify a cell by the grid-definition version and integer column/row. The version records resolution, CRS, origin, and edge convention. Proposed public shape: `<grid_version>:<column>:<row>`.
- Use one deterministic assignment rule, such as floor division into half-open cell intervals. Points on cell edges/corners belong to exactly one cell. Apply the same rule for negative projected values if supported.
- Boundary `covers` membership and grid assignment are separate steps. A point on the approved service boundary is eligible and must still receive exactly one cell.
- Multiple overlapping boundary polygons must not duplicate a business or its events.
- Future map geometry should use the standard GeoJSON longitude/latitude order in SRID 4326. The full cell can cross the reporting boundary; that geometry does not enlarge the eligible business scope. Rendering/clipping must not silently discard eligible points on the outer boundary.
- A changed CRS/origin/resolution requires a new grid definition/version. Preserve version metadata when comparing/exporting results; do not silently reinterpret old cell IDs.

PostGIS documents deterministic square tilings tied to a planar coordinate system and cell size: [ST_SquareGrid](https://postgis.net/docs/ST_SquareGrid.html). That function requires PostGIS 3.1 or later; its availability has not been checked on the application server. Selecting a particular function is not authorization to install or upgrade PostGIS. [ST_Covers](https://postgis.net/docs/ST_Covers.html) includes boundary points and requires valid geometries.

## Location-quality handling

Classify each filtered eligible business once, with mutually exclusive outcomes:

| Outcome | Treatment |
| --- | --- |
| Assigned | Usable point inside/on the approved scope; exactly one cell. |
| Missing/unusable location | Exclude from cells and disclose an exclusion count. |
| Invalid coordinates/geometry | Reject non-finite, empty, invalid, or out-of-range coordinates; disclose counts. |
| Unsupported SRID/transformation failure | Exclude with a controlled reason; do not reinterpret the coordinates. |
| Outside approved scope | Exclude and disclose counts; do not snap the point to an inside cell. |

Finalize reason codes and precedence during implementation review. Database constraints reduce some malformed cases but do not replace defensive handling. This branch must not repair, geocode, relocate, or delete application records.

Reconciliation invariant when geography is available:

`filtered_eligible_businesses = assigned_businesses + excluded_businesses`

Each assigned business contributes to exactly one cell. Sum of cell business counts equals `assigned_businesses`. A healthy empty eligible population differs from a missing boundary or failed location query.

## Metric and period semantics

Initial metric: **recorded PROFILE_VISIT event count** for businesses assigned to each cell.

- Reuse existing 7/30/90/custom periods, Manila calendar boundaries, and effective UTC `[start, end)` event filters.
- Preserve existing UTC-day visibility deduplication. Geographic grouping does not create new events or reinterpret counts as raw screen opens.
- Read visibility through an explicit set of business IDs and the maintained read-only helper; do not create indexes during reads.
- Read business-keyed counts once or in an explicitly bounded/reconciled strategy. Sum recorded profile visits across businesses assigned to a cell. Event counts are additive; visitor uniques are not.
- Distinct cell/platform visitors are outside the first metric contract. If added later, calculate distinct explorers over the full requested scope/period inside the source aggregation. Never sum per-business, per-cell, or daily uniques to obtain larger-scope uniques.
- Attribute selected events to each business's **current location at reporting time**. Visibility documents contain no event-time location. Existing approved location-change snapshots/audit do not establish a complete event-time location timeline; do not invent one.
- Current-location attribution can move historical recorded events between cells when a listing moves. Disclose this limitation. Do not claim historical foot traffic or explorer residence/movement.
- Return aggregate results without explorer IDs, event-level records, or precise personal locations. Business points are internal attribution inputs; the foundation's output is cell-level data.
- Do not add geographic growth comparisons, causal recommendations, revenue estimates, or automatic low-exposure classifications in this task.

When visibility is readable, document how assigned and excluded profile-visit totals reconcile to the same filtered inventory and period. A business exclusion must not silently disappear from the report's reconciliation metadata. Cross-database source reads are not an atomic SQL/Mongo snapshot.

## Availability, empty cells, and evidence

- Preserve source-specific availability: healthy SQL inventory must not be erased by Mongo failure.
- Successful zero recorded events may remain zero, with coverage-unverified disclosure. A Mongo failure yields unavailable/null event values, never a fabricated zero.
- A cell with no eligible businesses is different from a cell containing businesses with zero recorded visits. Expose population counts so the later heatmap/table can distinguish them.
- Unverified event coverage remains partial. Neither a large count, a source ping, nor an earliest event proves continuous collection.
- Missing/unavailable geographic data must not be styled as low activity or a successful empty result.
- Return event/business counts and measurement limitations. Do not introduce an arbitrary blanket five-interaction or five-business suppression rule. Any later privacy/sparse-data disclosure threshold requires its own reviewed rule.
- If output limits are needed, disclose truncation/limits explicitly. Do not silently drop cells or change resolution to fit a viewport. Verify query/runtime cost before choosing caching or precomputation.

## Reusable result contract

This is an internal service result, not an HTTP API:

| Section | Intended contents |
| --- | --- |
| Definition | Grid version, cell size, projected CRS/origin/assignment convention, output CRS. |
| Scope | Approved boundary identity/provenance or digest; current-location/current-population attribution notes. |
| Cells | Stable cell ID, column/row, derived cell geometry as needed, eligible business count, nullable recorded profile visits, measurement status. |
| Reconciliation | Filtered inventory, assigned/excluded counts by reason, and compatible recorded-visit totals when readable. |
| Metadata | Reporting period/clock, SQL/geography/visibility availability, coverage/freshness limitations, sparse/population context. |

Keep this foundation feature/service-owned using existing backend organization. The following heatmap branch should add the administrator HTTP contract, strict parameter validation, map/table presentation support, and `IsAuthenticated`/admin `HasRole` permissions. Do not expose an unguarded public analytics endpoint in the foundation task. Do not change public map-discovery payloads.

## Verification requirements

The user separately authorized disposable PostgreSQL/PostGIS database creation, migrations there, cleanup, and focused repair reruns. Application migration remains excluded. The initial documentation-only step ran no tests; implementation verification is recorded below.

Behavior covered by implementation tests and acceptance checks:

- Stable IDs/assignment across dates, ordering, filters, and viewport changes; exact cell edge/corner and outer service-edge handling.
- Inside/outside points, overlapping/inactive polygons, missing/invalid boundaries, malformed coordinates, SRID/transform failures.
- Current active population and existing classification validation; dormant verified flag and Premium status do not change inclusion.
- Whole-period event counts and UTC/Manila boundary behavior; no unique-count summation.
- Multiple businesses in one cell, one business changing location, and absence of an invented location history.
- Inventory and event reconciliation, empty population, no-business cells versus healthy zero-visit cells, and unavailable Mongo/geography.
- No index creation, provider calls, model writes, scoring changes, or identity leakage during reads.
- Runtime PostGIS/CRS capability and measured representative query/payload cost before deployment acceptance.

Synthetic SQL/Mongo tests establish behavior under fixtures, not live collection completeness, district validity, frontend/native acceptance, or production performance.

## Integration prerequisites and exclusions

At implementation base `a50b118c`, recommendation commit `f689cf46` remains separate. With explicit user approval this branch includes the same `reviews/0022_merge_media_cleanup_policy.py`, byte-for-byte, joining existing `0020_review_media_cleanup` and `0021_review_summary_policy_provenance` heads with no operations. Coordinate the shared file during integration; do not introduce a differently named duplicate merge. Recommendation models and merchant migrations are not introduced by this branch.

No new geographic persistence model, Django app, dependency, or migration is expected for a derived grid, subject to capability and design review. Any later need requires separate approval. Reuse existing boundary rows; do not seed or activate boundaries under documentation approval.

Outside this task: district/ barangay data acquisition, expansion beyond approved Cebu City coverage, explorer location collection, historical location reconstruction, offline previews, navigation-start instrumentation, new scoring/entitlement policy, AI generation, map UI, exports, and application deployment.

## Initial documentation checks (historical)

- Working tree was clean before branch creation.
- Remote read-only `git ls-remote` confirmed main `84b7fca7`; no fetch/pull was performed during inspection.
- Created this branch from recorded `origin/main` and added this contract only.
- Application database contents, loaded boundary records, coordinate quality, and server PostGIS version remain unqueried/unverified.
- No production implementation, test-database creation, migration application, dependency installation, staging, commit, or push was performed in this documentation step.

## Implemented services and integration handoff

Call `GeographicAggregationService.get_report(period, cluster=None, category=None)` from the later authorized admin heatmap service/view. Resolve `period` once using `apps.shared.analytics.date_ranges.resolve_period`; the maintained UTC half-open window is passed unchanged to the visibility reader. Cluster/category validation uses `BusinessAttentionService.eligible_businesses`.

The services live in `apps/admin_operations/analytics/services/geographic_aggregation_service.py` and `geographic_grid_service.py`. They perform reads only. There is no schedule, background job, AI request, scoring change, new persistence, or index creation.

- `definition`: version `cebu-utm51n-1000m-origin0-floor-v1`, projected SRID 32651, 1,000 metre cell edge, fixed origin, half-open assignment, output SRID 4326 and longitude/latitude order.
- `scope`: active approved PSGC `072217000` boundary IDs/update timestamps, WKB fingerprint, reference geometry digest and validation method. The union must be topologically equal to the reviewed `apps/business/data/cebu_city_boundary.json` geometry. Duplicate/overlapping approved rows do not multiply counts; unrelated active city rows cannot expand scope. Any changed reference/scope needs review. This pins the reviewed scope and does not claim the dataset is the latest official boundary.
- `cells`: every full square intersecting the approved boundary, sorted by column/row, including cells with no eligible businesses. Each has `id`, `column`, `row`, GeoJSON `geometry`, `eligible_businesses`, nullable `profile_visits`, and `measurement_status`. No business or explorer identifiers are returned. Whole-cell geometry crossing the city edge does not enlarge population membership.
- `reconciliation`: `eligible_businesses = assigned_businesses + excluded_businesses`; sum of cell populations equals assigned population. `excluded_by_reason` contains business counts and nullable visits for `missing_location`, `invalid_coordinates`, `unsupported_srid`, and `outside_scope`. When visibility is readable, `inventory_profile_visits = assigned_profile_visits + excluded_profile_visits`, and cell visits sum to assigned visits.
- `attribution`: explicitly identifies current active population and current business locations. Moving a listing can move its historical recorded visits to another cell. Profile visits are not physical arrivals.
- `sources`: independent `domain`, `geography`, and `visibility` metadata; `meta` describes the combined report. Source availability retains the shared metadata helper's partial/coverage/freshness conventions. Cross-store reads are not an atomic snapshot.

Missing/invalid/mismatched boundary, unavailable spatial functions, incomplete transforms, or assignments outside the returned grid produce `cells = null`, unavailable geographic/combined metadata, and unknown assignment/exclusion totals. Healthy SQL inventory and readable whole-inventory visibility totals remain present. A runtime transform failure invalidates the geographic result as a whole; it is not silently dropped or counted as a zero-activity cell. Unsupported stored SRIDs are excluded before transformation. Three-dimensional, empty, nonfinite and out-of-range source points are invalid coordinates.

Mongo failure preserves geographic populations and returns null visit values, including for empty cells; readable zero counts retain coverage-unverified measurement metadata. Do not infer continuous collection, popularity, quality, causes, or visitor uniques from these results.

Grid output is capped at 10,000 cells. Exceeding that limit returns unavailable geography with `cell_limit_exceeded`, rather than a truncated success or changed resolution; `truncated` remains false. Valid point projection uses batches of at most 1,000. The visibility reader is invoked once with the filtered inventory, as in existing attention services. No caching/precomputation is introduced before representative load measurements.

The next branch owns the authenticated admin HTTP endpoint, strict request serializers, `IsAuthenticated` and admin `HasRole`, standard response envelope, map legend, accessible table equivalent, loading/error/partial states, and frontend integration. Frontend must distinguish no businesses, readable zero visits, and unavailable measurements. This branch alone changes no mobile or web screen.

## Runtime and verification record

- Read-only local PostGIS check: version 3.6.2, server PROJ 8.2.1. Active boundary ID 1 has expected PSGC, valid nonempty SRID 4326 geometry, and was confirmed topologically equal to the repository reference.
- PostGIS generated 351 cells for that reference. One local warm-process read (boundary lookup, validation and grid generation) took about 0.200 seconds; serialized geometry/cell payload was 117,961 bytes before report metadata. This is a local capability sample, not production or concurrent-load acceptance.
- Real PostGIS conversion of longitude 123.88, latitude 10.31 assigned column 596, row 1139. Source points and boundary rows were not modified.
- Local GDAL's CRS import failed because the configured PROJ database layout is older than its loaded library expects. No environment/dependency change was made. These services use server-side PostGIS for transforms and grid generation; the read-only PostGIS checks passed independently.
- Implementation tests use real disposable PostgreSQL/PostGIS and fixture Mongo observations or a mocked visibility helper. They do not establish live Mongo completeness, frontend/native acceptance, deployment compatibility, or production performance.
- Final focused verification: **42 tests passed** in 0.701 seconds of test execution (database setup/cleanup additional); disposable test database cleanup completed. This final run includes the earlier 39-test run and must not be added to it as unique coverage. An intermediate 42-test run failed only the query-count assertion because it omitted the `WITH` grid statement; the assertion was repaired and the final complete focused command passed.
- `manage.py check`: no issues. `manage.py makemigrations --check --dry-run`: no changes detected. No geographic model/migration is required; the only migration file is the separately approved empty reviews join.
- The unfiltered populated fixture report executes five SQL read statements (including the `WITH` grid query), with no business-location N+1 reads. A 1,001-point projection fixture executes two projection queries and retains every assignment. Transaction/savepoint statements are additional. These checks bound query growth, not total inventory/payload memory or production latency.

Commands were run from `sugbogo_backend` using the repository virtual environment:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.admin_operations.analytics.tests.test_geographic_aggregation_service apps.admin_operations.analytics.tests.test_geographic_grid_service apps.admin_operations.analytics.tests.test_coverage_analytics_service apps.shared.analytics --noinput
& '..\.venv\Scripts\python.exe' -B manage.py check
& '..\.venv\Scripts\python.exe' -B manage.py makemigrations --check --dry-run
```

All migrations applied during verification targeted the disposable test database. No application-database migration or boundary seed/activation was performed. Changes remain local and unstaged for review.
