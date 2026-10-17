# Saved offline jeepney guidance

Branch: `feat/offline-route-cache`, based on `origin/main` at `e09a923a`.

## Scope and existing backend contract

This implements the approved user-initiated SQLite guidance snapshot direction. It does not change analytics, Discovery Score, transit calculations, PostgreSQL models, or the manuscript itself. It requires no new backend endpoint or Django migration. The decision/progress document on pending commit `9e5f731f` records this task's place after MongoDB verification; that commit is not a runtime dependency of this branch.

The maintained authenticated map API already returns the required selected journey:

`GET /api/explorer/explore/businesses/{business_id}/direct-journeys/map/?route_variant_id=...&boarding_transit_point_id=...&alighting_transit_point_id=...`

Reuse that successful payload and the loaded business identity. The snapshot includes route code/endpoints, boarding/alighting names/coordinates/sequences, route geometry, approximate ride distance, destination coordinates, optional landmark, saved starting point/label, destination ID/name, and device save time. It contains no authentication tokens, photos, entire business profile, reviews, or explorer movement history.

The first release saves SugboGo's jeepney guidance. Google-generated driving routes, downloaded basemap tiles, offline route recalculation, live navigation, real-time service updates, synchronization across devices, and offline mutation queues are outside this branch. Stored geometry is preserved as data; this first offline reader presents text guidance, not an offline map.

## User flow

1. While signed in and online, select a direct jeepney journey to a business.
2. On the journey map, choose **Save offline**. The screen explains that the starting point is saved on the device.
3. Open **Profile → Offline Data** to view or remove snapshots.
4. In airplane mode, open saved guidance without querying the API, requesting GPS, or depending on map tiles. Boarding/access distances use the saved origin, never pretend to be measured from the current device position, and are labeled straight-line estimates.
5. After a cold restart without connectivity, session restoration leaves authentication false and can route directly to the separate device-only guidance reader.
6. Sign in again when online to access authenticated screens. Reopening a live journey and choosing Save offline explicitly replaces its snapshot; no silent online refresh occurs in the offline reader.

Each snapshot displays its save date and cautions that stops/service may change. The optional seven-day review reminder is a provisional UI reminder, not an expiry guarantee or claim that newer routes are validated. Saving a route repeatedly replaces the same business/variant/boarding/alighting key, including a newly chosen origin, instead of duplicating it. Distinct stop combinations remain separate snapshots.

## Storage, account boundaries, and session behavior

- Expo SDK 57's compatible dependency is `expo-sqlite ~57.0.4`. The installed package and plugin are declared. See [the exact SDK documentation](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).
- SQLite initializes lazily on Android/iOS in `sugbogo_offline_guidance.db`, with the versioned `saved_journeys_v1` table. This is a device cache schema, not an application-server database migration.
- The primary key and every read/delete predicate include the public API environment string and owner ID. Navigation accepts a journey key, never an owner ID. In-flight reads recheck owner identity before displaying results.
- All data parameters are bound. The only unbound SQL execution is constant schema initialization. Save/cap enforcement and logout bulk cleanup use exclusive SQLite transactions.
- Initial named limits are 50 journeys per account/environment, 1,000,000 serialized characters per snapshot, and at most 10,000 coordinates per geometry. These are provisional resource limits, not industry benchmarks. Replacement is allowed at the cap; a new save asks the user to remove an entry first.
- Validate coordinates, ordered stop sequences, required fields, timestamps, geometry size, and format version. Strip unapproved fields. Corrupt or unsupported rows stay visible as unreadable entries so they can be removed without hiding healthy snapshots.
- A minimal owner/environment marker is in SecureStore. It grants only local reader access after a transport-failed boot with a retained token; it is never a JWT, verified identity, or permission to call an API. SQLite uses the platform app sandbox and default SQLite storage; this branch does not claim SQLCipher encryption or biometric protection.
- Authentication remains false during offline boot. Existing authenticated route guards stay in force. No server role/entitlement/business eligibility check is bypassed.
- Session restoration retains tokens only for recognized network/timeout failures; missing tokens, rejected sessions, or other failures do not grant offline access. Refresh transport failures likewise preserve tokens; a server rejection clears authentication even if secure-token deletion fails.
- New password/OAuth sessions revoke the old offline marker before replacing credentials. Saves and marker revocation are guarded/serialized so a pending save cannot regrant access after logout.
- Explicit logout revokes local access, attempts to delete that account/environment's snapshots, clears credentials/query cache, and signs out. If storage cleanup fails, show a notice; access is still revoked, but deletion of device copies must not be claimed. A later authenticated sign-in to that account can remove remaining copies.
- Account invalidation revokes offline access but does not claim that every cached row was physically erased. Offline operation cannot detect a newly suspended account or changed transit data until connectivity returns. Device guidance is not authoritative current service availability.
- Web intentionally offers a mobile-only explanation. This branch does not add the SQLite web WASM/header setup.

## Files and integration points

| Area                                                                | Responsibility                                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/features/offline-routes/`                                      | Snapshot validation, SQLite persistence, minimal owner access, local loading hook, save control, reader, and focused tests |
| `src/app/offline-routes.tsx`                                        | Thin device-only route with optional journey key                                                                           |
| `src/app/_layout.tsx`, `src/app/index.tsx`                          | Route registration and offline-boot entry                                                                                  |
| `JeepneyRouteMapScreen.tsx`, `ProfileScreen.tsx`                    | Explicit save and existing Offline Data menu integration                                                                   |
| `useRestoreSession.ts`, `authSession.ts`, `useLogout.ts`            | Boot, account replacement, and local cleanup boundaries                                                                    |
| `storage.service.ts`, `apiClient.service.ts`, `isTransportError.ts` | Marker revocation and transport-vs-rejection handling                                                                      |
| `app.config.ts`, `package.json`, `package-lock.json`                | SQLite plugin and compatible dependency                                                                                    |

Use the feature-owned storage functions and route rather than adding a server-side saved-route endpoint or using React Query's in-memory cache as durable persistence. No merchant Premium gate is involved in this explorer guidance feature.

## Automated verification

The approved focused verification completed on 15 October 2026 (Asia/Manila). Results and their limits are recorded below.

From `sugbogo_frontend/mobile`:

```powershell
npm test -- --runInBand src/features/offline-routes src/features/auth/hooks/__tests__/useRestoreSessionOffline.test.tsx src/features/auth/hooks/__tests__/useLogoutOffline.test.tsx src/features/auth/hooks/__tests__/useLogoutCommunity.test.tsx src/features/auth/utils/__tests__/authSession.test.ts src/shared/api/__tests__/apiClientOffline.test.ts src/shared/api/__tests__/storage.test.ts src/features/explore/screens/__tests__/JeepneyRouteMapScreen.test.tsx
npx tsc --noEmit --incremental false
```

Focused tests cover snapshot validation/corruption, account scoping, cap/replacement, logout and pending marker revocation, transport/rejection behavior, explicit save feedback, and local reader/deletion states. Expo's native bridge and SecureStore are mocked in the ordinary Jest cases. An additional five-test suite adapts Expo's driver surface to Node's actual SQLite engine and executes the repository's real SQL against a disposable file. It requires a Node runtime with `node:sqlite`; the recorded run used Node 24.15.0, without installing another dependency. These checks do not substitute for a native Expo binary or airplane-mode app restart.

### Recorded results

- All **62 tests in 13 suites passed**, with exit code 0, in 7.860 seconds. The final run produced no overlapping `act()` warnings.
- Five real desktop SQLite tests passed: durable file writes read by a fresh Node process after connection closure, duplicate-key replacement, two-account isolation and scoped deletion, the actual 50-row cap/replacement behavior, and corrupt-row handling alongside healthy rows. Exact temporary database files and their test-owned directory were removed after the suite.
- The initial run had seven failures from Jest's dynamic-import execution and three from an existing incomplete safe-area mock. Native SQLite now uses a static platform driver, with a separate web fallback; the safe-area mock preserves the actual view export. Follow-up assertions compare parsed snapshots rather than JSON property order and preserve the current starting-point labels. These are test/integration repairs, not changes to routing calculations.
- A brief `npx expo start --offline --port 8088` startup regenerated ignored local route types and was stopped afterward. The new offline route is present in those types; no native build or device test was performed.
- Project-wide `tsc` still exits with code 1 on **28 existing diagnostics**. A read-only in-memory comparison against the `e09a923a` source, using the same installed dependencies and regenerated route declarations, found **28 baseline diagnostics, 28 current diagnostics, and no additional diagnostics**. Examples include the custom Expo plugin type, outdated test fixtures/imports, review response typing, and a business-location mapper. This is not a clean project-wide TypeScript pass.
- Formatting completed and Git whitespace checks passed. The application's PostgreSQL/MongoDB data and local credentials were not used for these tests.

For Ralph: these results establish local guidance behavior and real desktop SQLite persistence under fixtures. The remaining acceptance gate is the actual installed Android/iOS build: save genuine guidance, restart in airplane mode, read it without GPS/network/map tiles, delete and restart, then verify logout/account switching. Do not mark the manuscript's native offline-restart requirement complete until that evidence is recorded.

## Required native acceptance for Ralph / frontend integration

Use a development or release binary containing the new native dependency; an existing development client may require rebuilding. A Metro-dependent development session alone may not cold-launch in airplane mode, so use an installed build capable of launching without Metro for the restart check. No native build, application-device cache mutation, or emulator setup is claimed by this branch's automated checks.

1. Sign in as account A. Load a genuine available jeepney journey and save it. Confirm the destination, route code, stops, landmark, origin, distances, and timestamp match the live payload.
2. Save the same journey again. Confirm there is one entry; changing the origin and saving again must replace that entry's saved origin.
3. Turn on airplane mode, force-close the installed app, and reopen it. Confirm the local reader is accessible and shows the same guidance without GPS permission, network, photos, or map tiles. Confirm authenticated Explore/Merchant screens remain protected during this unauthenticated boot.
4. Open a saved detail, confirm the saved-origin/straight-line labels, and remove an entry. Restart offline and confirm the removal persisted.
5. Reconnect and sign in. Confirm live APIs still require actual server authentication and no cached owner marker is used as an API credential.
6. Log out; confirm saved guidance is removed and a restart does not grant local access. Sign in as account B and confirm A's entries cannot appear, including through a copied journey key.
7. Exercise revoked/expired refresh credentials online and an unavailable-network refresh separately. Rejected sessions must fail closed; transport failure must not be mistaken for a server rejection.
8. Exercise the cap, unavailable device storage, unreadable entries, large text, safe-area controls, and deletion confirmation. Verify that storage failure is distinguishable from a healthy empty list.
9. Document real-device results, binary/version, and failures before declaring the manuscript's offline-restart requirement fulfilled.

## Installation observations

The approved Expo install added the dependency/lock entries but exited with a request to manually add the plugin to the dynamic config; that plugin was then added in source. npm reported 89 audit findings across the installed dependency tree and an unapproved `unrs-resolver` install-script notice. No audit fix, forced upgrade, extra script approval, prebuild, or dependency-family upgrade was performed. Those findings require a separate dependency review rather than attributing the entire audit total to SQLite.
