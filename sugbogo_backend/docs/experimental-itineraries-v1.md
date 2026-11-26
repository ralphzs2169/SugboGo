# Experimental jeepney itineraries v1

Enable the backend with `EXPERIMENTAL_ITINERARIES_ENABLED=true`. Both endpoints require an authenticated, active Explorer. With Django `DEBUG=True`, every such Explorer can use the preview. With `DEBUG=False`, the account must also appear in the comma-separated `EXPERIMENTAL_ITINERARY_EXPLORER_IDS` allowlist. This exception follows Django's DEBUG setting. On supported mobile development clients, the existing Jeepney Guide entry opens geometry-first guidance without requiring `EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED`; no duplicate preview button is shown. Release builds retain the legacy Jeepney Guide entry and the existing explicit experimental opt-in. The backend feature switch still defaults to disabled. Android uses the app's existing Google Maps setup. iOS still requires the native Google Maps key and build configuration; its existing release provisioning gate is unchanged.

## Contract

Both endpoints use `POST` with JSON, the existing SugboGo success envelope, and `Cache-Control: no-store`.

### Search

`/api/explorer/explore/businesses/{business_id}/itineraries/v1/search/`

Send `latitude`, `longitude`, and optional integer `max_transfers` from 0 to 2, default 2. The server uses the active business's current stored location as the destination.

The `data` object contains `business_id`, `origin`, `destination`, `max_transfers`, `options`, `reason`, `validation_stage`, and `coverage`. Coordinate objects use `latitude` and `longitude`. Each option contains `selection`, `rank`, ordered `route_sequence`, `transfer_count`, `route_alignment_status`, `passenger_access_verified`, `passenger_ready`, `has_blocking_evidence`, ordered `walking_statuses`, and the distance and ranking fields listed below.

An empty search returns one of `no_route_near_origin`, `no_route_near_destination`, `no_forward_journey`, `candidate_excluded_by_validation`, or `search_incomplete`. The first two indicate a missing nearby projected endpoint. A validation exclusion carries `validation_stage` equal to `minimum_ride_distance` or `spatial`. Spatial diagnostics report a nearby endpoint available only on excluded geometry, or a forward direct ride on an excluded line. Those lines never become options. An interrupted search with completed options returns them and records the interruption under `coverage`.

`coverage` includes eligible `nearby_origin_variants` and `nearby_destination_variants` counts, `geometric_candidates_considered`, `geometric_candidates_truncated`, `candidates_evaluated`, `alternatives_unchecked`, `walking_checks_deferred`, `walking_provider_unavailable`, `variants_excluded_by_spatial_validation`, and nullable `incomplete_reason` (`candidate_budget` or `connection_budget`). Provider errors are also reflected in each affected candidate's walking statuses. The walking provider flag does not establish that the network is disconnected.

Mobile selections retain their originating search coverage while loading and displaying detail. Optional graph coverage fields describe supported transfer variants, not how many variants a request fully searched. Passenger copy distinguishes routes omitted from the preview from candidate-work exhaustion, without displaying graph identifiers. Unreviewed or technical source-endpoint direction labels use a route-code-only instruction; reviewed readable direction labels remain available. Detail batches its access and transfer gaps into one PostGIS geography-distance query to match search distance semantics; corridor grouping and ranking remain unchanged.

Without the local indexed switch, graph search and live discovery retain their separate 20,000-work limits. That traversal completes shallower stages first and checks that each transfer can reach a later alighting position before expanding it. Direct itineraries and itineraries with transfers each retain up to 20 geometric candidates, ordered by corridor diversity, and contribute up to three preview options. Walking checks share one request budget and check the direct shortlist first. Close corridors can share a cell and the pilot can miss viable alternatives outside the budgets. A truncated or deferred evaluation leaves walkable alternatives unresolved.

Experimental search and detail require a valid, simple, nonzero, two-dimensional WGS84 LineString fully covered by the active Cebu City boundary. Candidates follow the stored vertex order and use forward slices that meet the minimum ride distance. Terminal names are stored display metadata. Experimental geometry eligibility, ride projections and selection freshness do not depend on terminal coordinates or route memberships. Admin authoring and the legacy spatial audit still check ordered memberships, stop-to-line proximity and terminal alignment.

The experimental API uses geometry-first guidance. It performs zero Google WALK requests during search and detail. The internal matcher still supports the optional 75/150-meter access samples for pedestrian experiments, while the guide uses its original local projections. Forward geometry, minimum ride length, access/egress radii, provisional transfer proximity, transfer limits and work budgets remain enforced.

Search retains the best geometric representative of each route sequence and transfer area. Direct itineraries have a separate result pool, so transfers cannot displace every direct option. Ranking uses straight-line access, transfer and egress distances plus the existing explicit transfer penalty, followed by ride distance and deterministic positional identity. Search performs zero Places lookups. The bounded preview retains up to three options per direct/transfer pool. Incomplete graph search remains explicit.

Compatibility walking fields remain in the response. Intentional omission uses status `not_evaluated`, null mapped distance, duration and polyline, and empty provider warnings. `walking_checks_deferred` and `walking_provider_unavailable` remain false when no provider check was attempted. A known prohibited or invalid access location still retains its independent evidence. `has_blocking_evidence` no longer acquires Google walking failures in the default guide flow.

### Detail

`/api/explorer/explore/businesses/{business_id}/itineraries/v1/detail/`

Send `selection` from the search response. The signed token is valid for ten minutes and binds the authenticated account, business and location, search origin, transfer limit, ordered route positions, variant revisions, and relevant access evidence. Keep it out of URLs, logs, and durable storage. It contains the search origin, so treat it as location data. The server revalidates before and after external evaluation, rebuilds the selected geometry, and checks current access and route-review evidence. Landmark availability can change between requests.

The `data` object contains `business_id`, `origin`, `destination`, `max_transfers`, `rank`, `transfer_count`, `route_alignment_status`, `passenger_access_verified`, `passenger_ready`, `has_blocking_evidence`, `ride_legs`, `transfers`, `access_walk`, `egress_walk`, and `totals`.

- Each ride contains `variant_id`, `geometry_revision`, `route_code`, `route_alignment_status`, nullable `route_provenance`, recorded `direction` labels with `from` and `toward`, `boarding`, `alighting`, `ride_distance_meters`, and ordered `geometry` coordinates.
- Each access object contains a `route_position` coordinate with `fraction`, a nullable `access_coordinate`, `coordinate_status`, `permission`, `passenger_location_verified`, and a nullable `landmark`. Landmarks include `place_id`, `name`, `address`, `location`, `distance_meters`, `source`, and provider `attributions` with `name` and `url`.
- Each transfer contains `from_variant_id`, `to_variant_id`, `validation_status`, `passenger_access_verified`, `passenger_ready`, `centerline_gap_meters`, `alighting_route_fraction`, `boarding_route_fraction`, and `walk`. The transfer coordinates are in the adjacent ride access objects and the walk endpoints.
- Each walk contains nullable `from` and `to` coordinates, `status`, nullable `diagnostic_code`, `straight_line_distance_meters`, nullable `mapped_distance_meters`, nullable `duration_seconds` and `encoded_polyline`, nullable `provider_start` and `provider_end` coordinates, nullable `source`, and `warnings`. Diagnostic codes distinguish conditions such as missing or displaced provider endpoints, missing provider configuration, and provider request failures. The API does not return raw provider errors. Mapped fields remain null in the geometry-first guide. Straight-line fields are explicitly estimated distances.
- Search options and detail totals use `mapped_walking_distance_meters` (nullable if any walk lacks a usable path), `straight_line_walking_distance_meters`, `ride_distance_meters`, `transfer_penalty_meters`, and `ranking_cost_meters`.

The existing error envelope carries invalid inputs as 400, unauthenticated requests as 401, and disallowed accounts as 403. A disabled feature, missing destination, or invalid or mismatched selection returns 404. A changed business location, variant revision, or relevant access record returns 409 `STALE_ITINERARY`. A variant that becomes ineligible also returns 409. An expired selection returns 410 `EXPIRED_ITINERARY`. An unavailable spatial audit boundary returns 503 `ITINERARY_SPATIAL_VALIDATION_UNAVAILABLE`. Server throttles are three search and six detail requests per minute per user, in addition to the existing general user rate.

Detail enriches boarding and alighting areas for each selected ride, including both sides of transfers, through the existing Google Places service. Up to six exact-coordinate lookups share the existing 12-second provider scheduling window. Duplicate coordinates reuse request-local results. Missing landmarks and Places failures leave the itinerary available. No provider content is retained between requests.

## Passenger evidence and mobile display

The optional `EXPERIMENTAL_ITINERARY_ROUTE_EVIDENCE` setting is a JSON array of records with `variant_id`, `geometry_revision`, `alignment_status` (`unreviewed`, `reviewed`, or `disputed`), and optional display-safe `provenance`. Setting `reviewed` requires a provenance reference and independent review of the current stored service alignment and direction. Missing or stale review records leave the geometry `unreviewed`. A disputed or unreviewed line can be inspected through the feature gate and Explorer permissions described above, including the non-debug allowlist. Its recorded terminal labels do not establish actual service.

The optional deployment setting `EXPERIMENTAL_ITINERARY_ACCESS_EVIDENCE` is a JSON array of trusted review records with `variant_id`, `geometry_revision`, `fraction`, `use` (`boarding` or `alighting`), `coordinate_verified`, `permission` (`unknown`, `permitted`, or `prohibited`), and access `latitude` and `longitude` when supplied. Evidence applies only to its exact position and revision. Empty evidence leaves locations provisional. Use verified curb or platform coordinates and independent operational permission, including for the starting and final ride. Provider snaps and nearby landmarks are display evidence.

Overall `passenger_ready` still requires reviewed alignment for every ride plus `passenger_access_verified`, which requires pedestrian connectivity and verified, permitted access. Default geometric guidance leaves pedestrian connectivity unchecked and therefore does not grant passenger readiness. Transfers apply the same rule to their two connected routes and endpoints. Route reviews and access records are checked when reopening a selection. The revision is now derived from the ordered geometry and route code. Old search selections and review records issued against the previous revision hash need a fresh search and review against the new revision.

The tester screen uses a Google-native map displaying stored jeepney geometry, origin, destination and suggested areas. It labels straight-line distances as estimates and keeps route-review and access warnings. Places references retain their Google and third-party attribution. Optional Walking directions actions open Google Maps with the two selected coordinates and walking mode. The app does not draw walking polylines or show provider walking-validation errors in its default guide. Production release still needs field verification, device and coverage checks, review of the applicable Google Maps terms, and an explicit allowlist or release decision. Any Phase 5 offline snapshot needs its own retention rules for Google content.

## Local indexed graph opt-in

The experimental search service can pass the existing Milestone 3.3 evaluator a managed-ID adapter for a verified development graph. Configure the following in the backend's ignored local `.env`, then restart the backend:

```dotenv
EXPERIMENTAL_ITINERARIES_ENABLED=true
EXPERIMENTAL_ITINERARY_DEVELOPMENT_GRAPH_ENABLED=true
EXPERIMENTAL_ITINERARY_GRAPH_REVISION=c15b848f53be340855e5f5edc8376c404ce87f4f6d0d416bdffe636931b31634
EXPERIMENTAL_ITINERARY_GRAPH_SHA256=c0d5094a143728873cd99fc8bb50d34be8513abd241f834f093c157e9e2b6b40
```

The graph lives at `.connection-graphs/<revision>/` and must already have its verified `graph.pair-index`, `inventory.json`, `complete.json`, and `graph.jsonl`. No graph generation runs in an API request. Compact metadata is reused within a worker. Sidecar identity changes trigger a metadata reload; graph/inventory/manifest changes invalidate a cached reader. Each selected block is authenticated before its records are reconstructed. Requests do not hash or load the complete graph.

Activation requires `DEBUG=True`, a loopback PostgreSQL host, and a connected server whose `inet_server_addr()` is loopback. Nonlocal or nondebug use, missing pins/artifacts, incompatible inventory, and corrupted selected data return HTTP 503 with `ITINERARY_GRAPH_UNAVAILABLE`. There is no live-discovery fallback when this opt-in fails. Disabling the switch restores the existing live-discovery path. This is development configuration, not a production deployment option.

Every artifact direction must match exactly one currently eligible managed variant by route code and ordered WGS84 EWKB. Artifact IDs are never assumed to be managed primary keys. Fractions, coordinates, gaps, evidence and record order are unchanged during translation. Mapping is rebuilt against current database identities for each search. Detail uses the existing signed managed IDs, fractions and geometry/evidence revisions; it restores the selected rides rather than performing another search.

The current local inventory has 64 eligible variants. All 58 graph directions map uniquely to managed IDs 7–64, including reversed source ordering for some route directions. The additional variants are managed IDs 1–6: two `14D`, one `17B`, one `13D`, and two `04LLLL`. Identical geometry on `04LLLL` does not permit aliasing it to graph `04L`. All 64 remain eligible for direct rides; transfer connectivity covers only the 58 matched directions. No route records are altered.

When enabled, `coverage` adds `graph_revision`, `graph_variant_count`, and `variants_outside_graph`. These additive fields are omitted on the old path. For transfer searches with nearby endpoints, uncovered variants prevent exhaustive coverage: `alternatives_unchecked=true` and existing `connection_budget` is used unless a more immediate existing interruption such as `candidate_budget` already applies. The uncovered-ID list distinguishes limited inventory coverage from a connection-read cap. Direct-only searches still cover all eligible managed variants; absent endpoints can still produce the established complete no-nearby-route diagnosis.

The indexed evaluator interleaves one- and two-transfer expansions under the unchanged shared 20,000-work budget and existing 20,000-source-record/8 MiB read caps. Sequences are visited by their minimum endpoint access-plus-egress bound, then deterministic variant identity. This changes bounded scheduling only: no sequence is removed and no distance/transfer ranking weights change. It prevents less promising low-ID routes from consuming the entire budget before closer boarding alternatives are visited. Full-search parity is covered by exhaustive fixture regressions. Remaining partial coverage is reported through the existing reasons.

Ranking remains geometric access + all geometric transfer gaps + geometric egress + 100 meters per transfer, with existing tie breaks and shortlist behavior. Two-transfer candidates may be validated and still lose every preview slot to cheaper one-transfer candidates. No transfer-depth quotas are added. All provisional access, unreviewed alignment, deferred walking and passenger-readiness rules remain in force.

### Local HTTP verification

Verification used authenticated TCP HTTP against `sugbogo_db` at `localhost` (server `::1/128`). Request middleware enforced read-only transactions and a five-second per-statement limit. Exact audit coordinates used process-local destination fixtures; no application business rows were created. A separate HTTP run used business 1's actual managed destination lookup without a destination override. All returned options were reopened successfully with HTTP 200; their rides were forward, at least 25 m, and had map geometry. Passenger readiness remained false. Ordered managed route geometry fingerprints were unchanged before and after.

Representative single-run search times include HTTP, authentication, eligibility, evaluation and serialization; they are not file-seeking benchmarks or statistically controlled latency estimates:

| Request | Live discovery | Indexed evaluator | Indexed raw validated direct / one / two | Indexed records / bytes read | Coverage |
| --- | ---: | ---: | --- | --- | --- |
| Audit distant-boarding case | 4.259 s | 5.827 s | 16 / 5,500 / 5,622 | 3,406 / 551,610 | candidate budget |
| Original direct 06G fixture, max 0 | 1.170 s | 1.377 s | 1 / 0 / 0 | 0 / 0 | complete |
| Original one-transfer destination, max 1 | 2.098 s | 5.333 s | 4 / 10,801 / 0 | 16,726 / 2,710,724 | candidate budget |
| Original northern destination, max 2 | 2.217 s | 6.629 s | 0 / 2,225 / 7,515 | 9,108 / 1,469,997 | candidate budget |

For the audit case, old discovery accepted 20,565 segment pairs and stopped at `segment_pair_budget`, yielding zero connections and zero transfer journeys. It returned direct 02B at score 230.17364014. Indexed search used zero live-discovery work and returned 04D → 02B, 04H → 02B and 09G → 02B at score 100.0 ahead of the preserved direct options. It consumed exactly 20,000 candidate work units, so these are partial recommendations.

The northern destination has one-transfer alternatives in the full network (08G/09G/10G → 13B at score 100.0); it is not a two-transfer-required full-network case. Its two-transfer candidates are evaluated but excluded by unchanged ranking/shortlisting. A small verified graph fixture separately proves a two-transfer-required network through search/detail, including actual TCP HTTP/JWT regression coverage. This does not assert that the full-network preview displays two transfers for that destination.

The real business-1 HTTP check returned three transfer options at score 137.85903078 before three direct options at 162.5663346; search took 9.486 s and reported `candidate_budget`. This is a functional coverage improvement, not a claim that the full-network search is fully optimized. Missing revision and checksum mismatch returned HTTP 503, without fallback. Detailed token-free HTTP evidence is retained locally under ignored `.analytics-demo/indexed-explorer-api/`.

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
