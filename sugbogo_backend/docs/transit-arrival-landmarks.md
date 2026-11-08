# Reviewed arrival landmarks

## Behavior

The existing direct Jeepney search remains the first choice. When it returns no
journey, a business's explicitly approved arrival landmark can provide an additional
arrival reference. The boarding search radius and forward stop-order checks remain
unchanged. Alighting must be within 500 metres of the arrival reference.

The business pin remains the actual destination. Distance fields still measure
alighting-to-business straight-line distance, which can exceed 500 metres for a
fallback journey. The landmark connection and map connectors are approximate;
neither establishes a pedestrian route or live service availability.

## Merchant and Admin workflow

1. Open the existing location and landmarks change request.
2. Add/select landmarks as usual, then designate at most one arrival landmark.
3. Enter directions from that specific landmark to the entrance.
4. Submit the request. The live business and routing behavior stay unchanged.
5. Admin reviews the roadside reference, access, and entrance directions in the
   existing request comparison and checklist. Approval publishes them atomically;
   rejection or withdrawal does not enable routing.

Generic Access notes remain independent. Editing them does not change the reviewed
landmark-specific directions. Updating/removing an approved arrival point goes
through the same review process. Existing change-request cooldown, ownership,
permissions, service-area validation, and stale-baseline checks still apply.

Existing landmarks default to `is_arrival_point=false`; none is automatically
certified as an arrival point. Registration does not opt landmarks in. Initial
arrival designation is a post-approval location request, allowing an explicit review.

## API and saved guidance

- Location proposal/live/snapshot landmarks gain `is_arrival_point` and
  `access_directions` fields. Arrival directions are required, trimmed, and limited
  to 1,000 characters. A location can have only one active arrival point.
- Fallback search journeys include `arrival_landmark` with ID, name, coordinates,
  and landmark-specific directions. Ordinary direct search results are retained.
- Map requests include optional `arrival_landmark_id`. The server checks current
  location ownership, current arrival designation, and stop proximity rather than
  trusting client coordinates or text. A stale or foreign reference is rejected.
- Map cache keys distinguish arrival-based selections. Maps show the arrival
  reference and approximate connectors through it.
- Offline format version 1 accepts an additive optional `arrival_landmark` object.
  Old snapshots remain readable. New snapshots preserve entrance instructions;
  saved guidance is historical and cannot verify later changes while offline.
  Saving the same business/variant/stops explicitly replaces its prior snapshot.

## Rollout

Two additive Django migrations are included: business `0035` and business_profile
`0005`. Apply both with the normal reviewed deployment migration process before
serving the updated backend. Do not migrate the application database just to run
the tests. The Django test runner applies migrations only to its test database.

No dependencies or native Expo plugins were added. Existing route geometries,
codes, passenger screens, and the direct-first search policy remain in place.

## Acceptance checks

- Existing direct destination: same ranked journeys, no arrival fallback.
- Remote business: ordinary landmark alone cannot enable matching.
- Pending, rejected, withdrawn, or foreign proposal: cannot enable matching.
- Approved arrival landmark: fallback returns a forward direct ride, actual
  business distance, arrival reference, and specific entrance instructions.
- No boarding point or no forward shared variant: retain a successful empty result.
- Map selection after removal or location change: reject the stale arrival ID.
- Save/restart offline: read the same arrival reference and entrance instructions;
  old snapshots without arrival fields remain readable.
- Native device: check long directions, large text, map footer scrolling/visibility,
  keyboard behavior, and the existing collapsed route/alternatives flow.

Automated checks supplement these acceptance checks; they do not certify actual
roadside access or replace a merchant/Admin review of real transit data.

## Verification on 7 November 2026

- 75 focused Django tests passed: direct journey search, map geometry, landmark
  context, authenticated API contracts, and location-change approval workflows.
  Includes approval gating, missing directions, multiple arrival points, ordinary
  landmark exclusion, direct-first ranking, forward-only matching, actual business
  distances, and stale/foreign map reference rejection.
- 64 mobile tests passed across 13 suites, covering proposal adapters and draft
  state, editor selection, review form, arrival text, maps, transport/cache keys,
  offline snapshot compatibility, and saved guidance screens.
- Four admin comparison tests passed; the admin web production build passed with
  dependency eval and bundle-size warnings.
- Django configuration and migration-consistency checks passed. Migrations were
  exercised in the test database; the application database was not migrated.
- TypeScript has 29 diagnostics in the unchanged Git baseline and 29 in the
  implementation, with no additional diagnostics. The comparison used an
  in-memory compiler host; existing files were not reverted to perform it.
- Two existing mobile suites remain failing: `JeepneyGuideScreen.test.tsx`
  fails during native Worklets initialization, and `JourneyOptionCard.test.tsx`
  has two assertions based on earlier expanded-card behavior and labels. Both
  failures were reproduced against unchanged Git source with an in-memory Jest
  transformer. Their production flows were not redesigned to satisfy old tests.
- Native device layout, real roadside data review, and offline cold restart remain
  manual acceptance checks. No claim of physical-phone verification is made.
