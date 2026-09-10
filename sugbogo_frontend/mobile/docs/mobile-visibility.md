# Mobile visibility instrumentation

## Implementation

Only Explore's API-backed New Businesses carousel records impressions. Explore is a vertical ScrollView containing horizontal ScrollViews, not a FlatList/FlashList. New Businesses loads with useNewBusinesses (React Query 5.101.4). Other sections, Community, and Map currently use mock businesses and no-op profile actions; there are no real category/cluster/specialty/search result routes to instrument yet.

The existing ScrollViews remain in place. useBusinessImpressions combines section, carousel, and card-container onLayout measurements with scroll offsets in both axes. It intersects card area with both viewports and conservatively excludes useTabBarSpacing() from the outer viewport to avoid counting cards beneath the floating navigation bar. Scroll callbacks are stable and use scrollEventThrottle=16. BusinessCard remains presentational.

A card must maintain at least 50% visible area for 500 ms. Eligible IDs accumulate for 750 ms before one mutation. Rendering, fetching, prefetching, and below-the-fold presence do not qualify. This ScrollView fallback uses layout/scroll observations because the existing list has no native viewability API.

The tracker reserves IDs while pending, in flight, or successfully submitted, for the mounted Explore experience. Leaving/re-entering the viewport does not repeatedly submit successful IDs. Final failures release the IDs; a later viewport exit and re-entry can start a new attempt. No device persistence or calendar-day logic exists. Backend daily deduplication remains authoritative.

useVisibilityMutations exports useRecordBusinessImpressions and useRecordBusinessProfileVisit. Both use the authenticated apiClient, request(), throwOnApiError(), and React Query useMutation. They perform no invalidation, refetch, cache update, Pocket update, or user-facing loading/error handling. Only business_ids are sent for impressions; profile visits send no body. Neither request contains user identity or timestamps.

NETWORK_ERROR, REQUEST_TIMEOUT, and VISIBILITY_TRACKING_UNAVAILABLE receive one retry after 1000 ms. Other errors do not retry. networkMode="always" allows the existing transport to reject offline requests and settle; mutations do not wait as an offline queue. Existing token refresh/session-expiry behavior remains in effect.

Business Profile already uses useExploreBusinessProfile and displays available cached content even after a refresh error. useBusinessProfileVisit records only when the route ID is valid, matches the displayed business ID, the route is focused, and the app is active. It attempts once per business/focus experience, including on cached display. Ordinary rerenders and tracking errors do not trigger another attempt. Blur resets the guard so returning may attempt again. Data GET/prefetching has no telemetry.

Pocket/Unpocket and their optimistic cache behavior are unchanged. Backend PocketService.create_pocket still uses transaction.on_commit to produce SAVE. Unsave does not delete historical SAVE events. No frontend SAVE visibility call exists.

Dwell timers are canceled on blur, app background, card removal, or unmount. On unmount, already-qualified queued IDs get one final flush. Promise handlers only touch private tracker sets, not React state. In-flight mutations can finish their bounded retry after departure. No unload guarantee or event persistence is provided.

## Files

Modified:
- src/features/explore/api/exploreBusiness.service.ts
- src/features/explore/screens/ExploreScreen.tsx
- src/features/explore/screens/ExploreBusinessProfileScreen.tsx
- src/features/explore/components/new-businesses/NewBusinessesSection.tsx

Added:
- src/features/explore/hooks/useVisibilityMutations.ts
- src/features/explore/hooks/useBusinessImpressions.ts
- src/features/explore/hooks/useBusinessProfileVisit.ts
- src/features/explore/utils/businessImpressions.ts
- src/features/explore/api/__tests__/visibility.service.test.ts
- src/features/explore/hooks/__tests__/visibilityHooks.test.tsx
- src/features/explore/utils/__tests__/businessImpressions.test.ts
- src/features/explore/screens/__tests__/visibilityScreens.test.tsx
- docs/mobile-visibility.md

## Automated verification

From the mobile directory:

```powershell
node node_modules/jest/bin/jest.js --runInBand --watch=false src/features/explore
```

Tests mock transport, native layout events, location, and decorative screen leaves. Hook tests use a real QueryClient. No backend, MongoDB, Redis, network, or new test dependency is required.

Coverage includes exact payloads/endpoints; no user identity/timestamps; data reads without telemetry; both React Query mutations; no cache invalidation; non-blocking failures; dwell threshold; intersection of horizontal/vertical viewports; batching; pending/in-flight/success deduplication; failed-ID re-entry; stable handlers; timer cleanup/final flush; displayed/cached/failed profile states; focus revisits; Pocket transport and optimistic state; Explore refresh and card navigation after telemetry failure.

Tests simulate layout values, not native rendering or actual physical scrolling. Device verification is still required.

Validation results:
- Focused Jest suite: 4 suites passed, 21 tests passed.
- ESLint on all changed production files: 0 errors; 2 pre-existing unused-variable warnings (Explore handleBusinessPress and profile isLoading).
- Repository TypeScript check: fails on existing example/auth/merchant errors; no visibility-file diagnostics remain.
- Device/backend verification has not been performed in this session.

## Manual verification

### Setup

1. In the backend directory, activate the project's existing Python environment and run `python manage.py runserver 0.0.0.0:8000`.
2. Configure the mobile app's existing EXPO_PUBLIC_API_URL to the reachable backend API base, including /api/. Start its normal development build with `npm start`.
3. Sign in as an explorer. Open the development network inspector and filter requests by `/explorer/explore/`. Use a test account and active businesses. No Celery recomputation is needed just to observe these requests.

### Impression

1. Mount Explore. While New Businesses is below the fold, verify there is no impressions POST merely because its GET completed.
2. Scroll vertically to New Businesses. Keep at least half of one or more real cards visible above the tab bar for over 500 ms. Wait approximately another 750 ms.
3. Confirm `POST /api/explorer/explore/visibility/impressions/` with `{"business_ids":[<visible IDs>]}`. Match IDs to the New Businesses GET response and visible names. There must be no identity or timestamp fields.
4. Scroll horizontally to reveal additional cards and pause. Confirm IDs accumulate into batches. Cards off to the side or below the fold must not be included.
5. Flick past an unseen card in under 500 ms. Confirm it does not qualify until a later sufficiently long exposure.
6. Scroll away and back. Already successfully submitted IDs must not produce continuous new requests in that mounted Explore screen.
7. Start exposing a new card, then switch tabs or background the app before 500 ms. Confirm the incomplete exposure is canceled; return and hold visibility again to qualify.
8. Leave Explore after a card qualifies but before its batch delay expires. Unmount may flush qualified pending IDs; merely blurring preserves the pending batch.
9. In a test environment, make the visibility endpoint return its controlled unavailable response. Confirm one retry, no toast/spinner/error replacement, and normal scrolling/navigation. After final failure, restore the endpoint, scroll that card fully out and back into view, and confirm a new attempt.

### Profile visit

1. Open a real business card. Once the profile content is displayed, confirm `POST /api/explorer/explore/businesses/{id}/profile-visit/` with no identity/timestamp/body.
2. Pull to refresh, change ordinary local UI state, and open/close the photo gallery. Confirm these rerenders do not produce another frontend visit attempt.
3. Leave the profile and return to the same business. A fresh attempt is allowed; backend deduplication can return duplicate=true.
4. Open a business whose profile has no cached data and whose detail GET fails. Confirm the normal profile error UI appears and there is no visit POST.
5. Reopen a cached profile. A visit is valid immediately when cached content renders.
6. Fail only the visibility endpoint. Confirm the profile remains usable throughout its bounded retry.

### SAVE

1. Pocket a business from the existing profile control.
2. Confirm only the existing `POST /api/explorer/explore/businesses/{id}/pocket/` action represents SAVE; there is no extra frontend visibility SAVE request.
3. Unpocket it and confirm the existing DELETE still works. Optionally inspect backend-owned discovery_visibility_events to verify historical SAVE remains.
4. Optional: inspect MongoDB server-side for IMPRESSION/PROFILE_VISIT documents and same-day deduplication. Do not add debug endpoints or mobile MongoDB access.

## Limits and deliberately excluded screens

- Mock Hidden Gems, Interests, Discover More, Trending, Map, and Community cards are not instrumented: their IDs are not real discovery records. Real search/category/cluster/specialty result screens do not currently exist.
- The ScrollView geometry assumes the current direct nesting and no transforms. If this hierarchy changes, its coordinate composition must be updated. A future virtualized list should use its own viewability API with the same batching concept.
- The bottom exclusion is deliberately conservative, using existing tab-bar spacing. Some partly visible cards near that area may be undercounted.
- Layout/scroll events approximate viewport exposure; arbitrary overlays and JS-thread stalls are not a general-purpose occlusion detector.
- Successful IDs remain suppressed until Explore unmounts, including across midnight; backend calendar-day rules are intentionally not reproduced on-device.
- Failed batches are eligible on a later exit/re-entry, not continuously retried while a card stays still.
- Qualified events can be lost on process termination or exhausted failures. There is no offline storage or guaranteed delivery.

No ranking, recommendation algorithm, Discovery Score UI, score snapshots/history, admin controls, moderation, specialty replacement, backend formulas, Celery scheduling, or unrelated fetching refactor was implemented.
