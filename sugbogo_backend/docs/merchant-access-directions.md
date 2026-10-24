# Merchant access directions

## Scope and behavior

Merchants can add an optional **How to reach us** note through the existing business-information editor (the Edit action beside About your business). This is a direct live-profile update and does not change merchant registration or require a change-request approval.

The note is plain text, trimmed at both ends, with a maximum of 1,000 characters. Newlines are preserved. Send an empty string to remove it; omitting the field from a PATCH preserves its current value. Null, oversized text and unsupported compound values return field validation errors. Existing businesses begin with an empty note.

Only the authenticated merchant's own active business can be edited. Existing authentication, role, ownership, suspended-business and update-allowlist checks apply. The merchant application's submitted registration information is not edited.

Explorers see a **How to reach us** panel labeled **Merchant-provided directions**:

- In the business profile's Plan Your Visit section.
- In the Jeepney guide below the search result, including a successful no-direct-route result or location-unavailable state when business details have loaded.

For example: “Get off at the public market, then take a motorcycle to our entrance beside the chapel.” The app displays the merchant's text; it does not validate, calculate or recommend that transfer. It does not draw new walking or motorcycle geometry, add fares, or change the direct-jeepney search/map endpoints. Blank or absent notes produce no panel. The map-first transport-choice hub and native map guide are unchanged.

## API and storage

- Model: `Business.BUSN_ACCESS_DIRECTIONS` (empty-string default).
- Write: `PATCH /api/merchant/business-profile/information/` with `{"access_directions": "Walk from the chapel."}`.
- Read: `access_directions` on the existing owner profile, information-update response and public business-detail response. List responses are unchanged.
- The existing mutation refreshes owner and Explorer profile queries; no additional endpoint or request is introduced.
- Mobile treats the property as optional for older responses/caches. New Offline Pocket and recently viewed snapshots retain the bounded text. Existing snapshots lacking it remain readable without a format-version change. The existing saved/previously loaded banners and timestamps still apply; saved text may be outdated until refreshed. Clearing a live note does not retroactively rewrite every device's saved snapshot.

## Migration and rollout

Migration: `business.0034_business_access_directions`, depending on the existing `0033_businessvouch_reliability_evidence`. It adds a blankable text field with an empty-string default; there is no business-content seed or external-service call.

From the repository root, with the intended database configured:

```powershell
cd sugbogo_backend
& "..\.venv\Scripts\python.exe" manage.py migrate --plan
& "..\.venv\Scripts\python.exe" manage.py migrate
```

Apply migrations before serving the updated backend, then restart backend workers/server and reload Expo. A backend started with `--noreload` must be restarted explicitly. Run the migration against each development/test database you intend to serve. Review any older pending migrations in the plan rather than assuming this field is the only outstanding change.

Local verification: `0033` and `0034` applied successfully to the isolated `sugbogo_transit_dev` database. The implementation initially left the ordinary local database untouched because its plan included older pending business/review migrations. A subsequent read-only audit confirmed `0034` was also recorded as applied in the ordinary database. Django's separate test database applied the new migration successfully. Other installations must still run their own migration plan and migrate commands.

This branch starts from `origin/main` at `e356c69c`. The earlier `test/transit-direct-route-baseline` fixtures are on their separate branch; this feature does not require its seed command. Previously created sample rows remain in the isolated database. Their synthetic merchant owners have unusable passwords and are not usable merchant logins; use a separate local merchant with its own business for editor acceptance. Do not enable a synthetic owner's login merely to work around this.

## Verification commands

From `sugbogo_backend`:

```powershell
& "..\.venv\Scripts\python.exe" manage.py test apps.merchant_operations.business_profile.views.tests.test_business_information_views apps.merchant_operations.business_profile.views.tests.test_business_profile_views apps.explorer_operations.explore_businesses.views.tests.test_direct_journey_views apps.explorer_operations.explore_businesses.views.tests.test_direct_journey_map_views apps.transit.services.tests.test_direct_journey_service apps.transit.services.tests.test_direct_journey_map_service apps.transit.services.tests.test_direct_journey_landmark_context --keepdb --noinput
& "..\.venv\Scripts\python.exe" manage.py check
& "..\.venv\Scripts\python.exe" manage.py makemigrations --check --dry-run
```

From `sugbogo_frontend/mobile`:

```powershell
npm test -- --runInBand --watch=false --runTestsByPath src/features/merchant/screens/merchant-mode/__tests__/MerchantBusinessInformationEditScreen.test.tsx src/features/explore/screens/__tests__/JeepneyGuideScreen.test.tsx src/features/explore/components/business-profile/__tests__/BusinessVisitInfoContent.test.tsx src/features/offline-pockets/validation/__tests__/offlineBusinessSnapshot.test.ts src/features/merchant/hooks/business-profile/__tests__/useUpdateMerchantBusinessInformation.test.tsx src/features/explore/services/__tests__/recentBusinessDetails.test.ts
npx tsc --noEmit --pretty false
```

## Recorded results (2026-10-24)

- Backend: 66 targeted tests passed against local PostGIS, including write/read-back, trim/clear, limit validation, rejected writes and existing direct-journey/map/landmark regressions.
- Mobile: 71 tests passed across six focused suites, covering editor save/clear, server validation, merchant attribution in the empty-route screen, hidden absent notes, cache refresh and snapshot compatibility.
- TypeScript: `tsc --noEmit --pretty false` passed.
- Django system check: no issues. Migration consistency: no changes detected.
- ESLint passed for changed mobile TypeScript files and the new directions component.
- Initial sandbox-only Jest cache writes failed with EPERM; the recorded run used the ordinary local environment outside that sandbox. Safe-area and native-map presentation dependencies are mocked in the focused unit tests. Backend tests use the existing external-service-isolation runner; no new real AI/provider calls are needed.
- An additional `OfflineBusinessBrowsing.test.tsx` run could not start because the native Worklets module's `loadUnpackers` was unavailable in Jest. It is not counted as a passing suite; the focused saved-note/schema/recent-detail tests passed.
- User-reported emulator acceptance: testing was completed and the directions feature was visible. This is a general user confirmation; individual save/clear, offline, accessibility and map checks were not separately enumerated.
- A separate local test merchant and owned fictional business (`DEV Access Directions Cafe`) were created in the isolated database. Live HTTP merchant login, owned-profile retrieval and the new directions response field were verified. No credentials or fixture account provisioning code are committed.

## Manual acceptance checklist

1. Sign in as a local active merchant with an owned business. Open profile → About your business → Edit.
2. Add landmark/walking/vehicle-change instructions; save, reopen and confirm the text persisted. Confirm Cancel/discard and the keyboard/save footer with a long multiline note.
3. Open the business as an Explorer. Confirm Plan Your Visit shows the attributed note. Open Jeepney and confirm the same text accompanies both successful and empty searches without replacing route results.
4. Clear the note and save. Refresh the Explorer detail; confirm the panel disappears and direct-route results stay unchanged.
5. Save/refresh a business snapshot, go offline and confirm the note is readable with the existing saved-data indication. Check that a snapshot saved before this field existed still opens.
6. Verify large system text, long multiline content, screen-reader labels and native map behavior on the emulator/device.

General emulator acceptance is recorded above; detailed results for each checklist item remain unrecorded. The prior Forward/Reverse/Disconnected emulator acceptance belongs to the earlier baseline branch. Web/admin editing, automatic transfers, structured itinerary steps, fares, landmark photos and discrepancy reporting remain outside this scope.
