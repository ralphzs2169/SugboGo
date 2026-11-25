# Experimental jeepney itineraries v1

Enable this preview with `EXPERIMENTAL_ITINERARIES_ENABLED=true`. Both endpoints require an authenticated, active Explorer. With Django `DEBUG=True`, every such Explorer can use the preview. With `DEBUG=False`, the account must also appear in the comma-separated `EXPERIMENTAL_ITINERARY_EXPLORER_IDS` allowlist. This exception follows Django's DEBUG setting. The native app shows the preview entry in Getting There when built with `EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED=true`. Both feature switches default to disabled. Android uses the app's existing Google Maps setup. For iOS, set a restricted Maps SDK key in `EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY` and rebuild the native test binary before enabling the preview.

## Contract

Both endpoints use `POST` with JSON, the existing SugboGo success envelope, and `Cache-Control: no-store`.

### Search

`/api/explorer/explore/businesses/{business_id}/itineraries/v1/search/`

Send `latitude`, `longitude`, and optional integer `max_transfers` from 0 to 2, default 2. The server uses the active business's current stored location as the destination.

The `data` object contains `business_id`, `origin`, `destination`, `max_transfers`, `options`, `reason`, `validation_stage`, and `coverage`. Coordinate objects use `latitude` and `longitude`. Each option contains `selection`, `rank`, ordered `route_sequence`, `transfer_count`, `route_alignment_status`, `passenger_access_verified`, `passenger_ready`, `has_blocking_evidence`, ordered `walking_statuses`, and the distance and ranking fields listed below.

An empty search returns one of `no_route_near_origin`, `no_route_near_destination`, `no_forward_journey`, `candidate_excluded_by_validation`, or `search_incomplete`. The first two indicate a missing nearby projected endpoint. A validation exclusion carries `validation_stage` equal to `minimum_ride_distance` or `spatial`. Spatial diagnostics report a nearby endpoint available only on excluded geometry, or a forward direct ride on an excluded line. Those lines never become options. An interrupted search with completed options returns them and records the interruption under `coverage`.

`coverage` includes eligible `nearby_origin_variants` and `nearby_destination_variants` counts, `geometric_candidates_considered`, `geometric_candidates_truncated`, `candidates_evaluated`, `alternatives_unchecked`, `walking_checks_deferred`, `walking_provider_unavailable`, `variants_excluded_by_spatial_validation`, and nullable `incomplete_reason` (`candidate_budget` or `connection_budget`). Provider errors are also reflected in each affected candidate's walking statuses. The walking provider flag does not establish that the network is disconnected.

Graph search and discovery retain their separate 20,000-work limits. Search completes shallower stages first and checks that each transfer can reach a later alighting position before expanding it. Direct itineraries and itineraries with transfers each retain up to 20 geometric candidates, ordered by corridor diversity, and contribute up to three preview options. Walking checks share one request budget and check the direct shortlist first. Close corridors can share a cell and the pilot can miss viable alternatives outside the budgets. A truncated or deferred evaluation leaves walkable alternatives unresolved.

Experimental search and detail require a valid, simple, nonzero, two-dimensional WGS84 LineString fully covered by the active Cebu City boundary. Candidates follow the stored vertex order and use forward slices that meet the minimum ride distance. Terminal names are stored display metadata. Experimental geometry eligibility, ride projections and selection freshness do not depend on terminal coordinates or route memberships. Admin authoring and the legacy spatial audit still check ordered memberships, stop-to-line proximity and terminal alignment.

Experimental endpoint discovery also samples positions approximately 75 and 150 meters before and after each nearby local projection, retaining only forward ride combinations inside the access and egress radii. These are centerline candidates. Sampling uses the stored line's normalized measure with geographic length to choose offsets, so offsets are approximate on lines with uneven segment distortion. Inputs less than the minimum ride distance apart retain the original projections alone. The geometric candidate and work budgets still apply.

Direct-only searches evaluate up to six candidates and spread those checks across both boarding and alighting positions. Transfer searches retain the existing per-pool shortlist size. Exact walking requests are deduplicated and all candidates share the existing 12-request and 12-second scheduling budgets. Ranking prefers journeys with no blocking walking evidence, then fewer failed walks, before comparing the existing costs. A blocked result is a diagnostic preview. Exhausting the shortlist cannot establish that every possible access point fails.

Walking detail includes nullable `provider_distance_meters`, `distance_limit_meters`, `provider_start_displacement_meters`, and `provider_end_displacement_meters` for diagnosing rejected paths. Provider distance can remain present when mapped distance is null because validation failed. Rejected geometry remains excluded from map rendering. Access and egress retain the 800-meter limit and provider endpoints retain the 30-meter tolerance.

### Detail

`/api/explorer/explore/businesses/{business_id}/itineraries/v1/detail/`

Send `selection` from the search response. The signed token is valid for ten minutes and binds the authenticated account, business and location, search origin, transfer limit, ordered route positions, variant revisions, and relevant access evidence. Keep it out of URLs, logs, and durable storage. It contains the search origin, so treat it as location data. The server revalidates before and after external evaluation, rebuilds the selected geometry, and checks current walking evidence. Walking results can change between requests.

The `data` object contains `business_id`, `origin`, `destination`, `max_transfers`, `rank`, `transfer_count`, `route_alignment_status`, `passenger_access_verified`, `passenger_ready`, `has_blocking_evidence`, `ride_legs`, `transfers`, `access_walk`, `egress_walk`, and `totals`.

- Each ride contains `variant_id`, `geometry_revision`, `route_code`, `route_alignment_status`, nullable `route_provenance`, recorded `direction` labels with `from` and `toward`, `boarding`, `alighting`, `ride_distance_meters`, and ordered `geometry` coordinates.
- Each access object contains a `route_position` coordinate with `fraction`, a nullable `access_coordinate`, `coordinate_status`, `permission`, `passenger_location_verified`, and a nullable `landmark`. Landmarks include `place_id`, `name`, `address`, `location`, `distance_meters`, `source`, and provider `attributions` with `name` and `url`.
- Each transfer contains `from_variant_id`, `to_variant_id`, `validation_status`, `passenger_access_verified`, `passenger_ready`, `centerline_gap_meters`, `alighting_route_fraction`, `boarding_route_fraction`, and `walk`. The transfer coordinates are in the adjacent ride access objects and the walk endpoints.
- Each walk contains nullable `from` and `to` coordinates, `status`, nullable `diagnostic_code`, `straight_line_distance_meters`, nullable `mapped_distance_meters`, nullable `duration_seconds` and `encoded_polyline`, nullable `provider_start` and `provider_end` coordinates, nullable `source`, and `warnings`. Diagnostic codes distinguish conditions such as missing or displaced provider endpoints, missing provider configuration, and provider request failures. The API does not return raw provider errors. When present, the mapped distance and duration apply to the accepted Google walking path.
- Search options and detail totals use `mapped_walking_distance_meters` (nullable if any walk lacks a usable path), `straight_line_walking_distance_meters`, `ride_distance_meters`, `transfer_penalty_meters`, and `ranking_cost_meters`.

The existing error envelope carries invalid inputs as 400, unauthenticated requests as 401, and disallowed accounts as 403. A disabled feature, missing destination, or invalid or mismatched selection returns 404. A changed business location, variant revision, or relevant access record returns 409 `STALE_ITINERARY`. A variant that becomes ineligible also returns 409. An expired selection returns 410 `EXPIRED_ITINERARY`. An unavailable spatial audit boundary returns 503 `ITINERARY_SPATIAL_VALIDATION_UNAVAILABLE`. Server throttles are three search and six detail requests per minute per user, in addition to the existing general user rate.

The API keeps the Phase 3 limit of 12 walking requests and schedules calls within a 12-second window, with a five-second provider timeout per call. An in-flight call may complete after the scheduling window. Search skips Places calls. Detail can perform up to six Places lookups for its selected rides. Provider responses are deduplicated inside each evaluation and discarded afterward.

## Passenger evidence and mobile display

The optional `EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE` setting is a JSON array of records with `variant_id`, `geometry_revision`, `alignment_status` (`unreviewed`, `reviewed`, or `disputed`), and optional display-safe `provenance`. Setting `reviewed` requires a provenance reference and independent review of the current stored service alignment and direction. Missing or stale review records leave the geometry `unreviewed`. A disputed or unreviewed line can be inspected through the feature gate and Explorer permissions described above, including the non-debug allowlist. Its recorded terminal labels do not establish actual service.

The optional deployment setting `EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE` is a JSON array of trusted review records with `variant_id`, `geometry_revision`, `fraction`, `use` (`boarding` or `alighting`), `coordinate_verified`, `permission` (`unknown`, `permitted`, or `prohibited`), and access `latitude` and `longitude` when supplied. Evidence applies only to its exact position and revision. Empty evidence leaves locations provisional. Use verified curb or platform coordinates and independent operational permission, including for the starting and final ride. Provider snaps and nearby landmarks are display evidence.

Overall `passenger_ready` requires reviewed alignment for every ride plus `passenger_access_verified`, which requires mapped walks and verified, permitted access. Transfers apply the same rule to their two connected routes and endpoints. Route reviews and access records are checked when reopening a selection. The revision is now derived from the ordered geometry and route code. Old search selections and review records issued against the previous revision hash need a fresh search and review against the new revision.

The tester screen uses a Google-native map, labels provisional endpoints, displays accepted walking geometry separately from ride geometry, and shows Google walking warnings and attribution next to provider content. Production release still needs field verification, device and coverage checks, review of the applicable Google Maps terms, and an explicit allowlist or release decision. Any Phase 5 offline snapshot needs its own retention rules for Google content.

## Phase 4 files

### Created

- Backend Explorer `serializers/experimental_itinerary_serializers.py`, `services/experimental_itinerary_service.py`, `views/experimental_itinerary_views.py`, and `views/tests/test_experimental_itinerary_views.py`.
- This backend contract document, `docs/experimental-itineraries-v1.md`.
- Mobile Expo route `src/app/(explorer)/business/[businessId]/experimental-itineraries.tsx`.
- Mobile Explore `api/experimentalItinerary.service.ts`, `constants/experimentalItinerary.constants.ts`, `hooks/useExperimentalItinerary.ts`, and `types/experimentalItinerary.types.ts`.
- Mobile Explore `screens/ExperimentalItineraryScreen.tsx`, `screens/__tests__/ExperimentalItineraryScreen.test.tsx`, `components/getting-there/ExperimentalItineraryDetails.tsx`, and `components/getting-there/ExperimentalItineraryMap.tsx`.

### Modified

- Backend `config/settings.py`, Explorer `urls.py`, and transit `coordinate_journey_service.py` and `pedestrian_journey_service.py`.
- Mobile `app.config.ts` and Explore `screens/GettingThereScreen.tsx`.
