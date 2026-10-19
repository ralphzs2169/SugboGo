# Recorded route-planning intent

Implemented as a Standard analytics capability. These observations measure
deliberate requests to open guidance, not successful route calculations,
completed journeys, transport bookings, or physical visits. No migration,
Discovery Score change, background generation, Plus entitlement, or new dependency
is required.

## Initialization and delivery investigation (October 19, 2026)

A read-only development inspection established that MongoDB was reachable but
the configured `sugbogo` database had no `route_planning_events` collection.
Previously, only an eligible ingestion POST initialized this collection. Analytics
GET and Retry could not initialize it. The missing collection explains the null
analytics counts; it does **not** establish why Android taps did not create an
event. No physical-device POST or live authentication failure was captured.
Code inspection found the deliberate tap callbacks, authenticated API client,
request payload, active-account checks and owner exclusions correctly connected.

Run the following once against the **intended configured development database**,
from `sugbogo_backend`, before testing an empty dashboard:

```powershell
.\.venv\Scripts\python.exe -B manage.py initialize_route_planning_tracking
```

This is a write/setup command, not a dry run. It creates/verifies the existing
indexes and upserts the singleton tracking marker using the server's current UTC
time. It creates no route observations, invokes no background jobs and requires
no Django migration. It is safe to rerun: output reports `initialized` or
`already_initialized`, the preserved `tracking_started_at`, and the index names.
Use normal deployment authorization before running it outside development.
It has not been executed against the shared development database as part of the
automated tests.

`RoutePlanningEventService.initialize_tracking()` is shared by the command and
eligible ingestion. Explicit setup always rechecks indexes rather than trusting
the process cache. MongoDB verifies existing index definitions; conflicts fail
with a controlled command error containing the driver class/code, without
dropping or replacing indexes. Invalid existing metadata fails rather than
silently resetting history. Existing events remain untouched. If events exist
without valid metadata, inspect their origin separately: this command establishes
a new boundary now and never reconstructs a historical start from those events.
Initialization does not certify delivery coverage or recover earlier activity.

## Exact collection triggers

On the current branch, business profiles open guidance directly; the former
Getting There screen is no longer an active screen. In mobile
`src/features/explore/screens/ExploreBusinessProfileScreen.tsx`:

- `handleViewRoute`: invokes `recordRouteIntent("ROAD_ROUTE")` when the Road Route
  action is tapped, then pushes the existing road-route screen immediately.
- `handleJeepneyGuide`: invokes `recordRouteIntent("JEEPNEY")` when the Jeepney
  guidance action is tapped, then pushes the existing guide screen immediately.

`useRoutePlanningIntent` uses an action-only React Query mutation with retries
disabled, `networkMode: "always"`, and `throwOnError: false`. Navigation never
awaits this request. Guests retain navigation but are not tracked; owner previews
are suppressed as a complementary safeguard. Backend ownership exclusion remains
authoritative. Merchants exploring another business may count.

There is no tracking in Road Route/Jeepney query hooks, rendering effects,
location updates, origin selection, map camera changes, result selection, Retry,
or Google Maps handoff. Opening guidance may count even if location permission is
denied or no usable route is subsequently available: the measured action is the
request, not route completion. Deep links that bypass these deliberate entry
actions do not create observations merely by mounting a guide.

## Authenticated ingestion contract

`POST /api/explorer/explore/businesses/<business_id>/route-intent/`

Requires an authenticated active explorer or merchant, as existing visibility
ingestion does. The business must exist and be active. Request body:

```json
{ "navigation_method": "ROAD_ROUTE" }
```

Allowed methods: `ROAD_ROUTE`, `JEEPNEY`. Extra body fields, including identities,
timestamps and locations, are rejected. The actor comes from `request.user` and
the business from the validated URL target. Example response (illustrative IDs):

```json
{
  "success": true,
  "message": "Route-planning request recorded.",
  "data": {
    "business_id": 9,
    "navigation_method": "ROAD_ROUTE",
    "recorded": true,
    "duplicate": false,
    "excluded_reason": null
  }
}
```

Repeated observations return `recorded: false, duplicate: true`. Owners return
both booleans false and `excluded_reason: "business_owner"`, before Mongo access.
Invalid payloads return 400, missing/inactive businesses 404, unauthenticated
requests 401, and denied/inactive roles 403. Mongo write failures use the existing
error envelope with 503 `ROUTE_PLANNING_UNAVAILABLE`. Failed collection must not
interrupt guidance. There is no durable client queue or background replay.

## MongoDB storage

Reuses `MongoDBService` and its configured database/connection timeouts. A separate
`route_planning_events` collection avoids changing visibility event types, legacy
deduplication, score inputs, seed schemas or aggregation behavior.

An observation contains only these fields, plus MongoDB's generated `_id`:

```javascript
{
  business_id: 9,
  explorer_id: 17,
  navigation_method: "ROAD_ROUTE",
  occurred_at: ISODate("2026-10-19T02:00:00Z"),
  utc_day: "2026-10-19"
}
```

`occurred_at` is captured on the server after collection initialization. It is
not a client tap timestamp. This ordering also prevents simultaneous first
requests from inserting timestamps before the initialization boundary.

Indexes are initialized by explicit setup or eligible ingestion, never by reporting:

- `route_intent_account_business_method_day_unique`: unique compound index on
  `explorer_id`, `business_id`, `navigation_method`, `utc_day`; partial filter
  `navigation_method: { $exists: true }` excludes collection metadata.
- `route_intent_business_time`: `business_id`, `occurred_at` for period reads.

`update_one(..., $setOnInsert, upsert=True)` plus the unique index enforces
account × business × method × UTC-day deduplication atomically. Duplicate-key
races are treated as duplicates. Repeats retain the original observation time.
UTC days start at 08:00 Manila time; changing Manila calendar date alone does not
reset deduplication. Request totals can exceed distinct accounts because an
account can request both methods and can count on different UTC days.

The collection also has one non-event document:

```javascript
{ _id: "tracking-state-v1", started_at: ISODate("...") }
```

It is persisted during explicit setup or initial ingestion, not inferred from observation totals
or reconstructed from seeded data. It bounds collection history only: it does
not establish deployment-wide instrumentation coverage, successful delivery from
every client, or outage-free operation. A failed first event can leave a valid
initialization marker without an observation. That is a recorded zero with
explicitly unverified coverage, not proof of zero requests by all explorers.

## Merchant reporting contract

`GET /api/merchant/analytics/standard/route-planning/?period=30`

Authenticated active merchant; ownership is resolved through the existing
`BusinessProfileService`. Plus is not consulted. Allowed presets are 7, 30 and 90
days, default 30. Unknown inputs, custom dates and client cutoffs are rejected.

The success envelope's `data` is:

```typescript
{
  business: { id: number; name: string; status: string };
  total_requests: number | null;
  distinct_explorer_accounts: number | null;
  road_route_requests: number | null;
  jeepney_requests: number | null;
  tracking_started_at: string | null;
  meta: StandardAnalyticsMeta;
}
```

`StandardAnalyticsMeta` retains the existing period timezone, start/end dates,
half-open UTC boundaries, generated/data-through times, availability, partial
reasons and coverage flag. No comparison fields are exposed.

The read-only Mongo pipeline scopes the owned business and selected Manila
period, excludes the current owner, and accepts only the two navigation methods.
It groups first by explorer account, then totals across accounts. Therefore:

- Road Route plus Jeepney equals total requests.
- Distinct accounts are deduplicated across both methods, not added together.
- No individual explorer identifiers are returned to merchants.

The effective lower bound is `max(period.start, tracking_started_at)` and the
upper bound is the existing exclusive reporting cutoff. Reads never create
collections, indexes, metadata, or events.

| Condition | Counts and metadata |
|---|---|
| Initialized, readable source, no matching observations | All four counts are 0; coverage remains unverified. |
| Readable recorded activity | Exact recorded totals; availability is partial because delivery/coverage is unverified. |
| Collection or initialization metadata missing | All four counts null; unavailable, with the corresponding reason. |
| Entire period predates initialization | Null counts; `tracking_not_started_in_period`. |
| Period overlaps initialization | Recorded counts from initialization onward; `tracking_started_during_period`. |
| Mongo connection/query failure | Null counts; `route_source_unavailable`; HTTP 200 still does not imply metric availability. |

All reports preserve `coverage_verified: false` and `best_effort_delivery`.
`data_through` remains unknown; connection success and first activity are not
coverage evidence. No previous-period growth is computed. Historical untracked
activity cannot be recovered, and the existing demo seeder does not populate this
new collection.

## Mobile presentation and caching

Overview order: Business overview → Specialty Support → Reviews needing replies
→ Visibility trends → Route-planning activity → More insights.

`AnalyticsRoutePlanning` reuses `AnalyticsOverviewSection`, AppText, SafePressable,
Skeleton, ErrorState and the centered analytics unavailable state. It shows exact
totals/accounts and two equal-scale method bars proportional to the backend
total. Legitimate zeros remain zeros; unknown values remain unavailable. The
information icon opens `AnalyticsRoutePlanningSheet` using the existing Gorhom
pattern, safe-area padding, dismiss control and backdrop.

`merchantRoutePlanning.service.ts` → `useMerchantRoutePlanning` → screen props
follow `apiClient → request → ApiResponse → throwOnApiError → useQuery`.
The key is `[...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY, accountId,
"route-planning", period]`, with no cross-account/period placeholder. Initial
loading, actual API errors, source unavailability, cached refresh errors and
genuine zero are separate states. Parent pull-to-refresh includes this query.
Only this query's `refetch()` is used by its Retry controls, and page notifications
follow `useQueryErrorNotification`. There is no polling or Plus lock.

Missing collection/metadata shows “Route tracking hasn't been initialized yet”
without Retry; this requires server setup. Dates entirely before tracking show
“No tracking history for these dates” without Retry. Recoverable source failures
use persistent section-level `ErrorState` with Retry. Initialized zero activity
shows all four numeric counts, without drawing a chart. The current method chart
and measurement sheet remain intact for valid activity. Partial-period reports
retain the actual counts and disclose unavailable earlier activity; the
measurement sheet provides the tracking-start timestamp in Manila time.

## Android delivery diagnostics and MongoDB verification

Development builds emit bounded `[route-intent]` diagnostics for deliberate taps:

- `skipped`: guest, inactive account, owner preview or invalid business target;
- `submitting`: Road Route or Jeepney method only;
- `HTTP response` / `HTTP request failed`: HTTP status when available;
- `result`: recorded, duplicate and owner-exclusion flags;
- `submission failed`: standardized API/transport error code.

No tokens, account identifiers, coordinates, request headers, raw error objects
or connection strings are logged. Release builds do not emit these diagnostics.
Server failures log the driver exception class/code and, for event writes, the
method. Normal Django access logs show request paths and HTTP status. Successful
ingestion outcome logging is at DEBUG level. There is no automatic event retry;
the shared authenticated client's existing expired-token refresh behavior remains
unchanged. A missing HTTP status can indicate rejection before reaching the
server, including offline/session checks; inspect the standardized error code.

To verify the actual device path:

1. Confirm the Android bundle's `EXPO_PUBLIC_API_URL` points to the running
   development backend, including `/api`. Restart Expo after environment changes.
2. Sign in with a separate active Explorer account, not the target business owner.
   Open that business's profile and tap Road Route once. Navigation must proceed.
3. Inspect Metro/device diagnostics and Django access logs for
   `POST /api/explorer/explore/businesses/<business_id>/route-intent/`.
   The body must contain only `navigation_method`. The shared API client attaches
   the stored bearer credential; never copy tokens into logs or documentation.
4. Expect HTTP 200 with `data.recorded: true`, or `duplicate: true` if already
   recorded that UTC day. A backend owner response has
   `excluded_reason: "business_owner"`. Check 400 payload/business validation,
   401 session, 403 role/status, 404 business and 503 MongoDB errors separately.
5. In the same configured database in Compass or mongosh, perform these read-only
   checks (replace the business identifier below):

   ```javascript
   db.route_planning_events.getIndexes()
   db.route_planning_events.findOne({ _id: "tracking-state-v1" })
   db.route_planning_events.find(
     { business_id: 9, navigation_method: { $in: ["ROAD_ROUTE", "JEEPNEY"] } },
     { _id: 0, business_id: 1, navigation_method: 1, occurred_at: 1, utc_day: 1 }
   ).sort({ occurred_at: -1 }).limit(10)
   ```

6. Repeat Road Route: no extra same-day observation. Tap Jeepney: its method
   count increases but the distinct-account total remains one for this account.
   Refresh guidance/change origin: no tracking POST should appear.
7. As the merchant, read
   `GET /api/merchant/analytics/standard/route-planning/?period=30` and refresh the
   Analytics section. An initialized empty source yields zero with partial,
   unverified coverage. Missing setup yields null counts with
   `route_intent_collection_missing` or `route_tracking_not_initialized`.
   MongoDB failures yield null counts with `route_source_unavailable`.
8. Check 7/30/90-day periods. Activity before initialization is unavailable,
   not zero; overlapping periods count only the available interval. The feature
   measures recorded guidance requests, not completed routes or physical visits.

These manual device checks remain required. Automated tests use Mongo doubles
and isolated Django test fixtures; live driver tests remain opt-in against an
explicitly configured safe local test database.

## Verification and manual QA

Initialization/delivery fix verification: 30 focused Django tests passed across
initialization/command, ingestion and reporting API modules. Twenty-nine focused
mobile tests passed across presentation, transport, hooks, guidance lifecycle
and the selected profile tap-callback case. The first mobile run exposed a
duplicate partial-data note (corrected) and a 5-second guidance test timeout;
the affected suites passed with a 20-second test timeout. Scoped ESLint completed
without remaining warnings, Python syntax checks passed, and `git diff --check`
passed. The safe local live-MongoDB test was skipped because no explicit test URI
was supplied. No application/shared database was initialized or seeded. Android
delivery remains a manual verification item.

Initial feature verification: 64 backend tests passed and the opt-in live MongoDB test was
skipped (65 cases total). Thirty mobile tests passed across focused runs,
including four affected Analytics-screen cases; unrelated cases in that broad
screen suite were not run. Scoped ESLint and affected-file TypeScript diagnostics
passed, 12 affected Python files parsed successfully, and `git diff --check`
passed. No live application MongoDB, production activity or physical device was
used for verification.

Focused backend tests use isolated PostgreSQL fixtures and a Mongo double. They
cover event contracts, unique-index configuration, concurrency/races, owner
exclusion, UTC-day boundaries, server timestamps, method/account totals, Manila
period boundaries, eligibility/permissions, missing history, unavailable sources
and read-only reporting. Existing visibility and Standard aggregation regression
tests are included.

Mobile tests cover transport, explicit taps, no lifecycle/refetch/origin tracking,
guest/owner safeguards, non-blocking failures without retries, exact count/bar
states, period/account keys, independent recovery and parent refresh. Native
maps and measurement sheets are isolated in screen tests; device behavior still
requires manual QA.

An optional real-driver test is disabled by default. On a **local test MongoDB**,
run from the backend directory:

```powershell
$env:SUGBOGO_LIVE_ROUTE_INTENT_VERIFY = "1"
$env:SUGBOGO_ROUTE_INTENT_TEST_MONGO_URI = "mongodb://127.0.0.1:27017"
.\.venv\Scripts\python.exe -B manage.py test apps.business.services.tests.test_route_planning_live_mongodb --noinput
```

It rejects remote/SRV/multi-host URIs, uses a direct local connection and a new
`sg_ri_<UUID>` database, verifies real concurrent upserts/aggregation, then removes
only that generated temporary database. It does not select the application's
database and must not be repointed at production infrastructure.

Physical Android/development integration checklist:

1. As a signed-in explorer, tap each guidance action; confirm POST bodies contain
   only the method. Confirm event fields/indexes in the development collection.
2. Repeat the same method during the same UTC day: count stays unchanged. Use the
   other method: its count increments, while the distinct-account count stays 1.
3. Refresh guidance, change location/origin and move the map: no intent POST.
4. Disconnect tracking or deny location: guidance navigation remains usable;
   a guidance request can count even when no route ultimately loads.
5. Repeat in owner preview and guest mode: no counted owner or anonymous activity.
6. Open Merchant Analytics, switch 7/30/90 days and pull-to-refresh. Verify exact
   totals, proportions, loading, unavailable, zero, error/Retry and cached states.
7. Check the information sheet, TalkBack, large fonts, narrow layouts and tab
   spacing. Confirm the labels cannot be mistaken for physical visits.

## Implementation file inventory

Backend paths are relative to `sugbogo_backend`:

- `apps/business/services/route_planning_event_service.py`
- `apps/business/management/commands/initialize_route_planning_tracking.py`
- `apps/business/services/tests/test_route_planning_initialization.py`
- `apps/business/services/tests/route_planning_fixtures.py`
- `apps/business/services/tests/test_route_planning_event_service.py`
- `apps/business/services/tests/test_route_planning_live_mongodb.py`
- `apps/explorer_operations/explore_businesses/serializers/route_intent_serializer.py`
- `apps/explorer_operations/explore_businesses/views/route_intent_views.py`
- `apps/explorer_operations/explore_businesses/urls.py`
- `apps/merchant_operations/merchant_analytics/serializers/route_planning_serializers.py`
- `apps/merchant_operations/merchant_analytics/services/route_planning_analytics_service.py`
- `apps/merchant_operations/merchant_analytics/views/route_planning_views.py`
- `apps/merchant_operations/merchant_analytics/views/tests/test_route_planning_views.py`
- `apps/merchant_operations/merchant_analytics/urls.py`
- `docs/recorded-route-planning-integration.md`

Mobile paths are relative to `sugbogo_frontend/mobile/src/features`:

- `explore/api/routePlanningIntent.service.ts`
- `explore/types/routePlanningIntent.types.ts`
- `explore/hooks/useRoutePlanningIntent.ts`
- `explore/hooks/__tests__/useRoutePlanningIntent.test.tsx`
- `explore/screens/ExploreBusinessProfileScreen.tsx`
- `explore/screens/__tests__/ExploreBusinessProfileSimilarPlaces.test.tsx`
- `explore/screens/__tests__/routePlanningLifecycle.test.tsx`
- `merchant/api/merchantRoutePlanning.service.ts`
- `merchant/api/__tests__/routePlanning.service.test.ts`
- `merchant/types/routePlanningAnalytics.types.ts`
- `merchant/hooks/analytics/useMerchantRoutePlanning.ts`
- `merchant/hooks/analytics/merchantAnalyticsQueryKeys.ts`
- `merchant/hooks/analytics/__tests__/useMerchantRoutePlanning.test.tsx`
- `merchant/components/analytics/AnalyticsRoutePlanning.tsx`
- `merchant/components/analytics/AnalyticsRoutePlanningSheet.tsx`
- `merchant/components/analytics/__tests__/AnalyticsRoutePlanning.test.tsx`
- `merchant/screens/merchant-mode/MerchantAnalyticsScreen.tsx`
- `merchant/screens/merchant-mode/__tests__/MerchantAnalyticsScreen.test.tsx`
- `merchant/__tests__/routePlanningAnalytics.fixtures.ts`
