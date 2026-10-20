# Discovery-source reporting

This Standard feature classifies existing recorded profile visits. It does not
change visit timing, daily identity, totals, distinct-account counts, Discovery
Score, or Plus entitlement. No migration, new collection, historical backfill,
background task, or extra index is required.

## Approved sources and navigation

| Identifier | Merchant label | Profile-opening action |
|---|---|---|
| EXPLORE_DISCOVERY | Explore | ExploreScreen's discovery-feed callback |
| SEARCH_RESULTS | Search & filtered results | SearchFilterResultScreen's business result |
| MAP | Map | MapScreen's selected-business preview |
| COLLECTION | Discovery lists | ExploreCollectionScreen's business result |
| SIMILAR_BUSINESSES | Similar places | SimilarPlacesSection's business card |
| COMMUNITY | Community | CommunityBusinessLink |
| UNKNOWN | Source not recorded | Missing, malformed, legacy, or unclassified origin |

The opening origin travels in `profileSource` through the Explorer profile route,
then into `useBusinessProfileVisit` and the existing mutation. It is local route
context, not global state. Missing or malformed parameters normalize to UNKNOWN.
The mutation captures business and source together, so an existing transient
retry retains its original source even if route props change. Existing focus,
matching-content, active-app, ownership, and retry behavior remains unchanged.

Review History and Vouch History are deliberately not instrumented. Their
existing navigation and visits continue normally with UNKNOWN attribution.
MY_REVIEWS and VOUCH_HISTORY are not accepted report categories. No source is
invented for mock Pockets, notifications, external referrers or advertisements.
The Explore map preview opens the full map; its eventual profile opening is MAP.
Search & filtered results includes category and specialty filtering, not only
keyword searches. Attribution describes an opening surface, not a full journey
or first-ever discovery.

## Ingestion contract and persistence

`POST /api/explorer/explore/businesses/<business_id>/profile-visit/`

```json
{ "discovery_source": "MAP" }
```

The body and field remain optional. Missing, null, invalid, structured or
unsupported source values become UNKNOWN without rejecting an otherwise valid
visit. Previously ignored unrelated fields remain ignored. Identity comes only
from authentication, the business from the URL, and time from the server.
The existing response remains unchanged:

```json
{
  "success": true,
  "message": "Business profile visit recorded successfully.",
  "data": { "business_id": 9, "recorded": true, "duplicate": false }
}
```

For new PROFILE_VISIT documents only, `discovery_source` is added to the existing
`$setOnInsert` payload in `discovery_visibility_events`. The filter remains the
same unique `dedupe_key`: event type × account × business × UTC day. Source is
never part of identity. The existing unique and event/business/time indexes are
unchanged. Analytics reads never create indexes or documents.

The first successfully persisted insert wins, including concurrent requests.
That is not necessarily the first tap or first HTTP response. Later duplicate
requests never replace a source, including UNKNOWN. A legacy document lacking
the field is not upgraded. A request timeout after a successful insert does not
permit its retry to replace the source. Owners remain excluded before writes;
guests cannot create identified observations.

## Standard merchant reporting

`GET /api/merchant/analytics/standard/discovery-sources/?period=30`

Periods: 7, 30, 90; default 30. Other query fields are rejected. An authenticated
active merchant's business is resolved by BusinessProfileService; Plus is never
consulted. Reporting uses the same half-open Asia/Manila period and event scope
as Standard profile visits.

One Mongo aggregation normalizes historical sources and groups counts. The total
is summed from those same grouped results, so distribution and total describe
the same response read. Independent Standard overview requests can naturally
have slightly different cutoffs or see newly arrived observations.

Illustrative response, not production/demo data inserted by this feature:

```json
{
  "success": true,
  "message": "Discovery-source analytics retrieved successfully.",
  "data": {
    "business": { "id": 9, "name": "Example business", "status": "active" },
    "profile_visits": 2,
    "sources": [
      { "source": "EXPLORE_DISCOVERY", "label": "Explore", "count": 0 },
      { "source": "SEARCH_RESULTS", "label": "Search & filtered results", "count": 0 },
      { "source": "MAP", "label": "Map", "count": 1 },
      { "source": "COLLECTION", "label": "Discovery lists", "count": 0 },
      { "source": "SIMILAR_BUSINESSES", "label": "Similar places", "count": 0 },
      { "source": "COMMUNITY", "label": "Community", "count": 0 },
      { "source": "UNKNOWN", "label": "Source not recorded", "count": 1 }
    ],
    "attribution_complete": false,
    "meta": {
      "period": {
        "timezone": "Asia/Manila",
        "start_date": "2026-09-20",
        "end_date": "2026-10-19",
        "start": "2026-09-19T16:00:00+00:00",
        "end_exclusive": "2026-10-19T05:00:00+00:00"
      },
      "data_through": null,
      "generated_at": "2026-10-19T05:00:00+00:00",
      "availability": "partial",
      "is_partial": true,
      "partial_reason": "client_reported_sources",
      "partial_reasons": [
        "client_reported_sources",
        "best_effort_delivery",
        "unattributed_profile_visits",
        "source_partial",
        "current_day_incomplete",
        "coverage_unverified",
        "freshness_unverified"
      ],
      "coverage_verified": false
    }
  }
}
```

`attribution_complete` means no recorded observations have an unknown source;
it is true for an empty readable report and null when reporting is unavailable.
It does not certify tracking coverage or navigation authenticity. Missing, null,
unrecognized and excluded historical sources all aggregate as UNKNOWN. No
historical tracking start or attribution date is inferred.

- Healthy readable zero: total 0, seven zero-count rows; unverified coverage.
- Unknown attribution: numeric counts retained, `attribution_complete: false`,
  `unattributed_profile_visits` reason.
- Missing collection or Mongo failure: total, sources and attribution completeness
  are null; existing Standard unavailable metadata/reasons remain intact.

## Mobile presentation and access

More insights → **Where visits came from** opens the dedicated static Standard
route `/(merchant)/analytics/discovery-sources`, using the selected period. Its
static route and explicit navigation are independent of Plus content. It does not
use PlusDetailKind, PlusAccessGate or openPlusDetail. The native merchant stack
provides the existing detail header and back behavior.

The report loads only when opened/focused. It uses the Standard query prefix:
`["merchant-standard-analytics", accountId, "discovery-sources", period]`.
It does not carry another account or period's placeholder data. Existing
same-key cached values remain usable during a failed refresh. The hook owns
errors; useApiErrorNotification reuses the established query notification
implementation, alongside persistent ErrorState and this query's refetch.

The screen shows the exact recorded total and descending nonzero source rows.
Bars share a zero baseline and scale to the largest count. Exact labels/counts,
including Source not recorded, remain visible. Zero activity has a centered
empty state; unavailable values remain unavailable. No percentage growth,
overview source chart, Plus request, new library or synthetic UI data is added.
The Gorhom sheet explains UTC-day identity, first-source retention, client
reporting, unknown origins and online versus physical visits.

## Implementation inventory

Backend:

- `apps/business/services/discovery_source.py`
- `apps/business/services/visibility_event_service.py`
- `apps/explorer_operations/explore_businesses/serializers/visibility_event_serializer.py`
- `apps/explorer_operations/explore_businesses/views/visibility_event_views.py`
- `apps/merchant_operations/merchant_analytics/services/discovery_sources_service.py`
- `apps/merchant_operations/merchant_analytics/serializers/discovery_sources_serializers.py`
- `apps/merchant_operations/merchant_analytics/views/discovery_sources_views.py`
- `apps/merchant_operations/merchant_analytics/urls.py`
- Source fixture/service/API tests plus the affected visibility view expectation
  and opt-in real MongoDB source-concurrency regression.

Mobile:

- `src/features/explore/constants/discoverySources.ts`
- `src/app/(explorer)/business/[businessId]/index.tsx`
- ExploreBusinessProfileScreen, useBusinessProfileVisit, useVisibilityMutations,
  exploreBusiness.service, and the six opening-action files listed above.
- `src/app/(merchant)/analytics/discovery-sources.tsx` and merchant stack layout.
- `src/features/merchant/types/discoverySources.types.ts`
- `src/features/merchant/api/merchantDiscoverySources.service.ts`
- `src/features/merchant/hooks/analytics/useMerchantDiscoverySources.ts` and
  merchantAnalyticsQueryKeys.
- `src/features/merchant/screens/merchant-mode/MerchantDiscoverySourcesScreen.tsx`
- `src/features/merchant/components/analytics/DiscoverySourcesMeasurementSheet.tsx`
- AnalyticsMoreInsights and MerchantAnalyticsScreen entry wiring.
- `src/shared/hooks/useApiErrorNotification.ts` (existing notification alias).
- Source transport, lifecycle, route, report, overview-entry and affected
  navigation regression tests.

## Deployment and manual QA

Deploy backend support before the updated mobile build. Old clients continue to
record UNKNOWN. Do not rewrite earlier events, including seeded records with
manifest fingerprints. There is no discovery-source setup command or migration;
normal visibility ingestion retains its existing index initialization behavior.

Use a separate active Explorer and a controlled development business. To test
each known source independently, use a fresh account or a different UTC day:
same-account/day observations intentionally keep their first source.

1. Open through each of the six approved surfaces; inspect the authenticated
   profile-visit POST and its optional discovery_source field.
2. In Compass, inspect that business's PROFILE_VISIT documents without editing
   them. Confirm source, dedupe_key and server occurred_at. Do not log tokens or
   export personal account histories.
3. Open through another source the same UTC day: count/source remain unchanged.
4. Open through Review History or Vouch History with a fresh account/day: the
   visit counts with UNKNOWN. Existing unknown visits are never upgraded.
5. As a merchant without Plus, open Where visits came from, switch 7/30/90,
   inspect source totals, pull to refresh, navigate back and reopen.
6. Check missing collection versus healthy zero only in an isolated test
   environment. Do not drop a shared collection to exercise failure states.
7. Verify TalkBack, large font sizes, narrow Android screens, bar labels, sheet
   dismissal, safe areas and native back navigation.

Automated tests use isolated SQL fixtures and Mongo doubles. The additional
real-driver concurrency test remains opt-in under the existing
SUGBOGO_LIVE_MONGO_VERIFY safeguard and a fresh generated test database. It must
not be used to mutate application/shared MongoDB data. Actual Android delivery
and live Mongo concurrency are not claimed without running those checks.

## Verification results

- 80 distinct affected Django cases passed across focused runs: source service
  and API behavior plus existing visibility ingestion and aggregation regressions.
- 93 distinct mobile cases passed across focused runs, including the six approved
  origins, excluded history navigation, source-bearing lifecycle/retries, API
  transport, detail states/cache and the Standard overview entry.
- The new real-driver source-concurrency case was skipped because live MongoDB
  verification was not explicitly enabled. No shared MongoDB records or indexes
  were changed.
- Scoped TypeScript diagnostics were clean for 23 affected production files;
  explicit Standard-route navigation was checked again after its final update.
- ESLint passed for new files and the corrected source/navigation tests. The
  wider affected-file lint run still reports the pre-existing
  react-hooks/set-state-in-effect error in SimilarPlacesSection's delayed-loading
  effect, plus existing visibilityScreens test warnings. That production effect
  was not changed for this feature.
- Affected Python syntax checks and git diff --check passed. No full-project
  checks or unrelated production refactors were performed.
