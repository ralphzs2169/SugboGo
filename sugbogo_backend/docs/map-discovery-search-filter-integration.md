# Map Discovery search and filtering integration

## Registration audit and reuse

Inspected:

- `src/features/merchant/components/registration/location/BusinessLocationSearchSheet.tsx`
- `src/features/merchant/components/registration/location/LocationPickerHeader.tsx`
- `src/features/merchant/screens/LocationPickerScreen.tsx`
- `src/features/merchant/hooks/registration/useRegistrationPlaceSearch.ts`
- `src/features/merchant/hooks/location-selection/useBusinessPlaceSearch.ts`
- Shared `PlaceSearchFeedback`, `PlaceSuggestionRow`, and `presentBottomSheet`.
- Explore `BusinessCard`, `SearchFilterBottomSheet`, `useDiscoveryResults`,
  `useExploreFilterOptions`, taxonomy-selection helpers, and discovery API service.

Registration's search sheet uses the existing Gorhom modal at 94% height, an
integrated text input, fill-parent keyboard behavior, restored keyboard blur,
pan/backdrop dismissal, Android Back interception, and safe-area-aware results.
Its resolving Google-place IDs, provider calls, service-area validation, and
registration location payload are feature-specific. The map therefore adapts its
presentation in a feature-owned business-search sheet without extracting a new
shared abstraction or changing Registration. Existing modern Explore compact
business cards supply search-result presentation. The Explore taxonomy sheet is
reused directly; its only added integration prop is an optional dismissal callback.

## Global search and destination selection

Global search reuses `GET /api/explorer/explore/discovery/`, the existing Explore
API service, hook, response types, relevance ordering, pagination, and query cache.
The shared hook accepts an optional enabled flag, defaulting to its original
behavior. The map wrapper debounces input for 350 ms, requires two trimmed
characters, caps input at the API's 200-character limit, and hides previous-term
results while the next term is debouncing. No viewport or map filters are sent.
Name, category, cluster, and active-specialty matching remain backend-owned.

A selection is handed to the map after the sheet dismisses, allowing its keyboard
and modal transition to finish first. The existing selected-business ID remains
the selection authority. The camera animates to the chosen coordinates; its
completed destination viewport is committed automatically, preserving map filters.
A compact `map/?business=<id>` request resolves the selected business's current
eligibility and global gem flag without fetching a full profile. This avoids
losing a search selection to the 200-marker page cap or active map filters.

If the selected result is not in the ordinary map response, one selected marker
is pinned alongside those results. Copy explicitly identifies a search selection
shown separately from active map filters. Closing the preview or searching a new
area removes the pin. Request keys and cancellation isolate rapid consecutive
selections; late old results cannot replace the newer selection. Profile
navigation continues through the existing real-ID Explorer route.

## Map filters and backend contract

The viewport endpoint retains its response and pagination contracts. Optional
parameters are now:

- `cluster`: positive ID.
- `category`: repeated positive IDs, ORed within this list.
- `specialty_tag`: positive ID, matching active assignments only.
- `hidden_gems`: boolean, defaults to false.
- `open_now`: boolean, defaults to false.
- `business`: positive ID for the compact selection lookup.

Cluster/category/specialty use the existing taxonomy serializer and queryset
helper. Independent filters intersect, and no filter changes the unfiltered global
Top 10 Hidden Gem subquery. No ranking calculation, score, or numerical position
is exposed or recomputed. There are no migrations.

Applying or clearing filters reads native visible boundaries where available,
commits them, and updates applied filter state together. The last completed
viewport remains the fallback for providers without native boundaries. Ordinary
pans update only the viewed area; Search this area commits it using the same
filters. Query keys contain normalized bounds and deduplicated, sorted categories
plus the remaining applied criteria. Invalid viewports remain disabled, failures
have persistent Retry, and incomplete marker coverage remains explicit.

Open Now uses stored weekly hours in Asia/Manila. Opening is inclusive and closing
exclusive. Today's 24-hour row matches all day; overnight rows include the
previous day's spillover, including Sunday into Monday. Missing, closed,
incomplete, and equal-time ordinary schedules do not imply availability. An SQL
Exists expression avoids per-business schedule queries. Open Now queries have a
30-second stale time and refresh every minute while successful; request errors
stop automatic interval/focus refresh until explicit recovery. Other map queries
retain five-minute caching and their existing focus behavior.

New is deferred: the existing collection sorts every active business by creation
date and provides no recent-business eligibility cutoff. No arbitrary rule was
introduced. Near Me is omitted because the existing locate control already
provides that geographic interaction. No decorative or unsupported chips ship.

## Verification and remaining considerations

- 57 backend tests passed: viewport services/API, new filter behavior, global
  membership, schedule boundaries, discovery search, and Explore collections.
- 88 frontend tests passed across 13 suites: map flow, search sheet and debounce,
  selection handoff, filters, destination camera/selection, stale requests,
  caching, Retry, limits, Registration search compatibility, Explore search and
  taxonomy helpers, and shared marker compatibility.
- Relevant ESLint and `git diff --check` passed. Changed Python files compile.
- Full TypeScript checking reports 64 existing errors outside the changed areas.
- Ruff is not installed in the backend virtual environment; backend automated
  lint could not run.
- Native keyboard/sheet animations, map-provider camera callbacks, landscape,
  large system text, and screen-reader interaction still need device QA. Sheet
  behavior is covered with native component mocks in local tests.
- Open Now reflects stored weekly schedules, without holiday exceptions or live
  presence data, and can lag a schedule boundary by up to the refresh interval.
- Map coverage remains a bounded first page, plus at most one explicitly pinned
  search selection. Dense-area query plans and marker rendering should be measured
  with production-scale Cebu data before increasing caps.

## File inventory

Paths are relative to the SugboGo repository root.

Created:

- `sugbogo_backend/apps/explorer_operations/explore_businesses/services/operating_hours_filter_service.py`
- `sugbogo_backend/apps/explorer_operations/explore_businesses/services/tests/test_map_discovery_filters.py`
- `sugbogo_backend/docs/map-discovery-search-filter-integration.md` (this report)
- `sugbogo_frontend/mobile/src/features/map/components/MapBusinessSearchSheet.tsx`
- `sugbogo_frontend/mobile/src/features/map/components/__tests__/MapBusinessSearchSheet.test.tsx`
- `sugbogo_frontend/mobile/src/features/map/hooks/useMapBusinessSearch.ts`
- `sugbogo_frontend/mobile/src/features/map/hooks/__tests__/useMapBusinessSearch.test.tsx`

Modified:

- `sugbogo_backend/apps/explorer_operations/explore_businesses/serializers/map_discovery_serializers.py`
- `sugbogo_backend/apps/explorer_operations/explore_businesses/services/map_discovery_service.py`
- `sugbogo_backend/docs/map-discovery-api-contract.md`
- `sugbogo_frontend/mobile/src/features/explore/components/search-filter-results/SearchFilterBottomSheet.tsx`
- `sugbogo_frontend/mobile/src/features/explore/hooks/useDiscoveryResults.ts`
- `sugbogo_frontend/mobile/src/features/map/api/mapDiscovery.service.ts`
- `sugbogo_frontend/mobile/src/features/map/api/__tests__/mapDiscovery.service.test.ts`
- `sugbogo_frontend/mobile/src/features/map/components/MapSearchOverlay.tsx`
- `sugbogo_frontend/mobile/src/features/map/hooks/useMapDiscovery.ts`
- `sugbogo_frontend/mobile/src/features/map/hooks/__tests__/useMapDiscovery.test.tsx`
- `sugbogo_frontend/mobile/src/features/map/hooks/useMapViewport.ts`
- `sugbogo_frontend/mobile/src/features/map/screens/MapScreen.tsx`
- `sugbogo_frontend/mobile/src/features/map/screens/__tests__/MapScreen.test.tsx`
- `sugbogo_frontend/mobile/src/features/map/types/mapDiscovery.types.ts`

