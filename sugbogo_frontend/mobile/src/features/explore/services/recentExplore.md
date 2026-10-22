# Offline cold-start Recent Explore

Recent Explore is a local-only view of the three approved persisted homepage
feeds. It never sets authentication, grants a role, hydrates the authenticated
QueryClient, or bypasses `useAuthGuard`. Its routes are `/recent-explore` and
`/recent-explore/[businessId]`, outside both protected role groups.

## Startup and ownership

`useRestoreSession` calls the shared `restoreSession` service, also used for
reconnect. A valid token and successful `/users/me/` response retain normal
authenticated routing. Missing tokens and definitive authentication failures
revoke temporary content and local grants through the existing cleanup paths.

Only transport failure uses `suspendAuthSession`: the generation advances and
API authority becomes inactive, while temporary disk content survives. This is
distinct from explicit `invalidateAuthSession`, which still deletes temporary
content. A runtime transport-failure flag is required for eligibility probing;
neither stored JSON nor a retained identity marker can independently grant access.

The existing SecureStore `offline_guidance_owner_v1` owner/API marker is reused.
After validated authentication it now records known identity even without a
durable resource. Empty durable storage releases its runtime durable grant but
keeps this marker so clearing Offline Storage does not inadvertently remove
Recent Explore. The marker grants no resource by itself. Explicit logout/session
revocation still removes it. Existing durable resource checks remain unchanged.

`restoreRecentExploreAccess` requires that trusted marker, matching owner/API,
the current transport-failure generation, supported persisted format/policy/DTO,
valid per-entry age and size, and at least one non-empty approved feed. Discovery,
New Businesses or Recommendations qualify. Empty feeds, shortcuts, Specialties,
and filter metadata alone never qualify. All validation reuses Task 2/3 policies.
Eligibility checks never rewrite content or refresh its fetch timestamp.

The Recent Explore grant lives only in `useOfflineAccessStore`. It is separate
from the durable `ownerId` grant and is not serialized. Reads check grant identity,
generation and API scope before and after storage work. Explicit replacement,
logout and expiry revoke it synchronously. While reconnect validation is pending,
the previously granted local scope may remain readable, without API authority;
successful validation removes the grant, and rejection revokes/deletes it.
Old work cannot publish into a newer owner or same-user session.

Startup precedence after onboarding:

1. Authenticated: existing setup/role routing.
2. Durable local resources: Offline Storage, which also offers Recent Explore
   when its independent grant exists.
3. Recent Explore only: open Recent Explore directly.
4. Neither: existing verification/login destination.

## Presentation and navigation

`useRecentExplore` reads only policy-validated local feed entries via the
persistence coordinator's serialized `readLocal` API. It does not run feed API
functions or hydrate private data into normal query keys. Local read queries use
`networkMode: always`, zero GC and dedicated unapproved keys. Screen-focus and
original-expiry deadlines recheck availability. The last expired/removed feed
revokes the local grant and shows an intentional unavailable state.

The screen reuses the normal pure `BusinessCard`, `ExploreSectionHeader`, `AppText`,
surfaces and horizontal spacing. It never uses the Pocket-card wrapper, impression
observer, location requests, search/filter navigation or live homepage hooks.
Only non-empty local sections render. One quiet status line and one update time
(the oldest displayed feed) describe the screen. Cards have no mutation callback.
Failed remote image decoding now uses the normal card placeholder. No managed
images are downloaded.

Business taps stay in the local route group. `RecentExploreBusinessScreen` uses
Task 4's `ReadOnlyBusinessProfile`/`OfflineBusinessContent`. A readable matching
Pocket repository result takes precedence over recent detail; corrupt, missing
or pending Pocket data may fall through to readable recent detail. The existing
durable grant is required to read Pocket storage. Recent-only access never
authorizes that database. Temporary detail remains owner/API scoped, 48 hours,
twenty entries and 64 KiB per entry; optional LRU access never renews fetch age.
If neither detail source is readable, the route offers Back to Recent Explore.
The read-only back callback also stays inside the local experience.

No live business profile, review/private-review request, insight synchronization,
similar-business hook, profile analytics, vouch/Pocket mutation, or new route
calculation is imported or mounted by this path. Pull-to-refresh in detail reads
local sources only. Pocket content keeps Device copy wording and managed local
cover behavior. Recent detail uses remote image metadata and native image cache
when available; placeholders remain useful without image bytes.

## Reconnect and cleanup

`RecentExploreReconnect` mounts once beside the existing Query lifecycle bridge.
For an active recent grant, online/focus transitions invoke the same restoration
service. Repeated transport failure retains local mode; no mutation queue exists.
Only validated server identity triggers normal startup routing. Definitive
rejection follows existing token/temp cleanup and login routing. Stale validation
does not navigate over a newer session. Listener cleanup and a busy/attempt guard
prevent duplicate validation on the same transition.

Tasks 2/4 coordinators revoke old write handles on transport suspension and
restoration, but preserve disk. Explicit replacement/revocation still removes
their own dedicated keys. The anonymous provider handle cannot delete matching
disk data when authenticated restoration succeeds. Local feeds are never written
back by eligibility or display. Policy age stays based on original fetch, and no
new query families or retention windows are enabled.

Offline Pocket databases, managed images and journeys retain separate storage and
deletion policies. Expiring Recent Explore never deletes durable resources.
Physical storage deletion remains best effort when the device storage fails.

## Validation and Android checklist

Deterministic tests cover persisted policy validation, scope/owner mismatches,
corruption/expiry, startup precedence, durable coexistence, late reads/session
replacement, reconnect outcomes, source priority and local-only rendering.
Equivalent layout tests cover 320/390/430-point widths, larger text, long names,
missing covers, section omission, touch labels, back behavior and absent mutation
controls. These tests do not substitute for native pixel-level visual review.

Physical-device verification is pending:

1. Log in online; load all Explore feeds and open several business profiles.
2. Force-close, enable airplane mode, and reopen SugboGo.
3. Confirm local access without authentication. With durable resources, open
   Recent Explore from Offline Storage; otherwise it should open directly.
4. Check persisted sections, one status/update line, scrolling and missing covers.
5. Open a previously viewed business. Verify read-only information and no
   vouch/review/Pocket/route controls. Confirm readable Pocket detail takes priority.
6. Disable airplane mode. Confirm identity validation occurs and only a successful
   response returns to normal authenticated Explore.
7. Repeat with revoked/expired credentials: definitive rejection must revoke
   Recent Explore and route to login. A transport error alone must not claim
   credentials were rejected.
8. Check small-screen/large-text layout and back navigation on the physical device.

Accounts need one successful authenticated session on this version to register
the shared known-owner marker if they never previously saved an offline resource.
If SecureStore identity cannot be resolved, local access fails closed. Network
connectivity does not guarantee server reachability; repeated transport failures
leave local content available only within its original retention windows.

## Changed production files

New files:

- `src/app/recent-explore.tsx`
- `src/app/recent-explore/[businessId].tsx`
- `src/features/auth/services/restoreSession.service.ts`
- `src/features/explore/components/RecentExploreHeader.tsx`
- `src/features/explore/components/RecentExploreReconnect.tsx`
- `src/features/explore/hooks/useRecentExplore.ts`
- `src/features/explore/screens/RecentExploreScreen.tsx`
- `src/features/explore/screens/RecentExploreBusinessScreen.tsx`
- `src/features/explore/services/recentExplore.service.ts`

Modified files:

- `src/app/_layout.tsx` and `src/app/index.tsx`
- `src/features/auth/hooks/useRestoreSession.ts`
- `src/features/explore/components/business-profile/ReadOnlyBusinessProfile.tsx`
- `src/features/explore/components/new-businesses/BusinessCard.tsx`
- `src/features/explore/services/recentBusinessDetails.service.ts`
- `src/features/offline-pockets/screens/OfflineStorageScreen.tsx`
- `src/features/offline-routes/services/offlineAccess.service.ts`
- `src/features/offline-routes/stores/offlineAccess.store.ts`
- `src/shared/api/authSessionGeneration.service.ts`
- `src/shared/query/queryPersistence.service.ts`

Focused tests accompany startup routing, eligibility/storage, screen/detail
presentation, local hook lifecycle and reconnect behavior. Existing auth,
Offline Storage and persistence lifecycle tests reflect the transport-suspension
contract. Related persistence documentation is updated alongside this document.
