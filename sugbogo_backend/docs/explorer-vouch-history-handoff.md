# Explorer business-grouped vouch history handoff

Date: 2026-10-10 (Asia/Manila)

## Scope and confirmed decisions

Task 1 changes history to one entry per eligible **business**, containing all of
the requesting user's currently visible specialty endorsements. Businesses are
paginated before their endorsements are loaded. Individual vouch rows, multiple
specialty endorsements, mutations, constraints, scoring and frontend files remain
unchanged. No models or migrations are added.

## Files

Paths below are relative to `sugbogo_backend/`.

| File | Change and responsibility |
| --- | --- |
| `apps/explorer_operations/explore_businesses/services/vouch_history_service.py` | Modified: shared eligible-vouch filter, unique business queryset, latest endorsement annotation, page-scoped prefetches and full-history aggregate totals. |
| `apps/explorer_operations/explore_businesses/serializers/vouch_history_serializers.py` | Modified: business row mapping and nested original endorsements, retaining ordering validation and reused category/tag serializers. |
| `apps/explorer_operations/explore_businesses/views/vouch_history_views.py` | Modified: paginates businesses and adds full-history summary to the existing response envelope. |
| `apps/explorer_operations/explore_businesses/views/tests/test_vouch_history_views.py` | Modified: grouping, ordering, totals, pagination, visibility, mutation compatibility and query-efficiency coverage. |
| `docs/explorer-vouch-history-handoff.md` | Modified: current API contract, implementation findings and frontend handoff. |

No files were deleted. The pre-existing frontend `MapView.tsx` working-tree change
was left untouched. `urls.py` is unchanged: the existing `vouch-history` route is
reused. The original endpoint was introduced in commit `4d44a7d`.

## Reused implementation

- Models: `BusinessVouch`, `Business`, `BusinessSpecialtyTag`, `SpecialtyTag`,
  `Category`, and `User`.
- Response serializers: `ExploreCategorySerializer` and
  `ExploreSpecialtyTagSerializer` from `explore_business_serializer.py`, plus
  `ReviewVouchedSpecialtySerializer` from
  `apps/reviews/serializers/review_serializers.py`. The latter already maps a
  vouch to its specialty ID, name, color and icon.
- API utilities: `core.pagination.StandardPagination`, `IsAuthenticated`,
  `apps.authentication.permissions.HasRole`, default JWT authentication,
  default throttling and `core.exceptions.custom_exception_handler`.
- Existing `BusinessVouchView` and `VouchService` remain the mutation path;
  `BusinessSpecialtyService` is used in tests for assignment lifecycle behavior.
- History follows the `ACTIVE` business and `BST_IS_ACTIVE` assignment visibility
  used by `ExploreBusinessService.get_business_detail`, without loading reviews,
  locations, photos or other unused detail data.
- Tests reuse `core.tests.assertions.APIResponseAssertionsMixin`.

`VouchHistoryService._eligible_vouches` is reused for selecting businesses,
prefetching their endorsements and calculating the complete summary. A correlated
subquery supplies each business's latest eligible endorsement timestamp, avoiding
duplicate rows from joins. Prefetching runs only after the business page is sliced;
neither the complete business history nor its complete endorsement set is loaded
into Python to perform grouping.

## Endpoint and response contract

`GET /api/explorer/explore/vouch-history/`

Route name: `vouch-history`. Requires `Authorization: Bearer <access_token>` and
an active authenticated user with the Explorer or Merchant role. Merchant access
matches the existing Explorer business detail and vouch endpoints. Admin and
Super Admin roles do not grant access.

| Query parameter | Behavior |
| --- | --- |
| `ordering` | `newest` by default; accepts `oldest`. Both sort businesses by their most recent eligible endorsement. Other values return HTTP 400 with `VALIDATION_ERROR` and `errors.ordering`. |
| `page` | Existing page-number pagination, starting at 1. Invalid or out-of-range pages return HTTP 404. |
| `page_size` | Existing default 10 and maximum 100; uses `StandardPagination` parsing and fallback behavior. |

There is no user-selection parameter: the query always uses `request.user`.
Newest orders by `last_vouched_at` descending, then business ID descending;
oldest uses both fields ascending. `last_vouched_at` always means the latest
eligible endorsement, including when ordering is `oldest`. Within every business,
`vouches` is always ordered by original creation timestamp descending, then vouch
ID descending, regardless of the business ordering parameter.

The following example uses illustrative IDs and timestamps. All returned keys
are shown; there is no separate top-level count or `business` wrapper.

```json
{
  "success": true,
  "message": "Success.",
  "data": {
    "items": [
      {
        "id": 12,
        "business_id": 12,
        "business_name": "History Bistro",
        "cover_photo_url": "https://example.com/history-cover.jpg",
        "category": {"id": 3, "name": "History Restaurants"},
        "last_vouched_at": "2026-10-10T01:00:00Z",
        "vouches": [
          {
            "id": 101,
            "specialty": {"id": 7, "name": "History Spicy", "color": "red", "icon": "utensils"},
            "created_at": "2026-10-10T01:00:00Z"
          },
          {
            "id": 100,
            "specialty": {"id": 8, "name": "History Traditional", "color": "blue", "icon": "chef_hat"},
            "created_at": "2026-10-09T01:00:00Z"
          }
        ],
        "specialty_tags": [
          {"id": 7, "name": "History Spicy", "color": "red", "icon": "utensils", "vouch_count": 2, "is_vouched": true},
          {"id": 8, "name": "History Traditional", "color": "blue", "icon": "chef_hat", "vouch_count": 1, "is_vouched": true},
          {"id": 9, "name": "History Cozy", "color": "green", "icon": "heart", "vouch_count": 0, "is_vouched": false}
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 1,
      "total_items": 2,
      "total_pages": 2,
      "has_next": true,
      "has_previous": false
    },
    "summary": {
      "total_businesses": 2,
      "total_specialty_vouches": 3
    }
  }
}
```

In this example `page_size=1` and the second eligible business, with one
endorsement, is on page 2. Summary totals include it even though it is not shown.

The row's `id` and `business_id` both identify the business; `vouches[].id`
identifies the unchanged individual vouch. Original timestamps are preserved in
`vouches[].created_at`; no replacement vouch or grouped record is stored.

Exact full-history summary paths:

- `data.summary.total_businesses`: unique eligible businesses.
- `data.summary.total_specialty_vouches`: eligible endorsements across all those
  businesses, not just the page.
- `data.pagination.total_items`: unique eligible businesses, equal to
  `total_businesses` for unchanged data.

Empty history returns `items: []`, page 1, `total_items: 0`, `total_pages: 0`, both
navigation flags false and both summary totals zero. The `items`/`pagination`
envelope is preserved; only this endpoint adds `data.summary`. Shared pagination
code is unchanged.

## Confirmed existing mutation and scoring behavior

- `POST /api/explorer/explore/businesses/<business_id>/vouch/` accepts `tag_id`
  and optional `device_id`. It returns the existing successful mutation payload
  with `id`, `business_id`, `tag_id` and `is_vouched: true`.
- The uniqueness constraint is `(BUSN_ID, USER_ID, TAG_ID)`. Duplicate specialty
  vouches are rejected; the same user can vouch for multiple specialties of one
  business. Different users can vouch for the same specialty.
- Creation rejects the business owner and tags not actively assigned to the
  business. It locks the user, business and assignment; stores the user's
  reputation snapshot; marks evidence valid; increments `BUSN_VOUCH_COUNT` and
  `BST_VOUCH_COUNT`; and calls `ReputationService.apply_vouch_reward` within the
  transaction. The reward is keyed by user/business/specialty and subject to the
  existing configuration and reputation cap.
- `DELETE` on the same endpoint uses a JSON body containing `tag_id`. It deletes
  only the requesting user's matching vouch and decrements both counters.
  Missing vouches return the existing HTTP 404. Removal does not reverse the
  reputation reward; recreation creates a new ID/timestamp and does not award
  the same logical reward again.
- There is no dedicated specialty-switch mutation. Creating another specialty
  vouch leaves existing vouches intact; removing one is a separate operation.
  History introduces no implicit replacement or switching behavior.
- Specialty scoring reads `VOUCH_EVIDENCE_IS_VALID=True` evidence, including
  timestamp decay and reputation snapshots. Business specialty recomputation
  uses active assignments. Discovery score recomputation is performed by the
  existing task scheduled daily at 02:00 UTC. Vouch creation/removal does not
  directly enqueue or recompute discovery scores; this feature preserves that.
- Assignment deactivation retains vouch rows and stored counters. Reactivation
  makes the existing rows visible again. Business deletion cascades to vouches.

## Interpretation and integration limits

The history definition of **active** is an existing vouch on an active business
with an active matching specialty assignment. This is a deliberate interpretation
of the request based on existing Explorer visibility. `VOUCH_EVIDENCE_IS_VALID`
is a scoring flag, not a removal flag: invalid evidence remains visible in history
and in the existing tag `is_vouched` state. This distinction is tested.

Business/category/specialty details are current values, not snapshots from the
creation time. Suspended businesses and retired specialties disappear from both
the grouped endorsements and summary totals. A business appears only while it has
at least one eligible endorsement by the requesting user. Their vouches are not
deleted by this read endpoint. Removing or retiring the newest endorsement makes
`last_vouched_at` fall back to the newest remaining eligible endorsement.

Normal merchant submission/classification flows require three active specialty
tags. History serializes the actual active assignment set, ordered by assignment
ID; it does not invent, truncate or repair tags if legacy data has another count.
`vouch_count` is the existing stored assignment counter, not a scoring-evidence
count or a value recalculated during this request.

Pagination is deterministic for unchanged data, but uses the existing page-number
contract. Concurrent additions/removals can shift pages; no snapshot/cursor
guarantee is introduced. Page selection, prefetches and summary aggregation are
separate reads, so totals and rows are not an atomic snapshot during concurrent
mutations. Query-count tests exclude authentication database reads
by using forced authentication; a separate test exercises actual bearer JWT.

The user approved business grouping, latest-eligible-timestamp ordering and
preservation of individual endorsements. No live frontend, external service or
worker validation is included. The original per-specialty response contract is
superseded; clients consuming that shape need an integration update.

## Frontend handoff and documentation

- Use the row's business `id` as the key; each eligible business appears once.
- Read business badge totals from `data.summary.total_businesses` or
  `data.pagination.total_items`. Read endorsement totals from
  `data.summary.total_specialty_vouches`; do not derive either from page length.
- Render `vouches` as the user's endorsements, retaining each `vouches[].id` as
  its key. There is no longer a top-level singular `specialty` or `created_at`.
- Render `specialty_tags` as the business's current selection with user-specific
  flags and stored counts. Multiple tags may have `is_vouched: true`.
- Resolve icon and color tokens through the existing frontend mapping; icon
  values are names such as `chef_hat`, and color values are names such as `red`.
- Provide the existing image fallback for null or blank `cover_photo_url`.
- Continue using the existing POST/DELETE endpoint with the entry's
  `business_id` and the selected `vouches[].specialty.id` or `specialty_tags[].id`
  as `tag_id`. DELETE requires its JSON body; there is no bulk remove mutation.
- Removing one endorsement retains the row when another eligible endorsement
  remains. Removing the last removes the row. Re-vouching creates a new nested
  vouch ID/timestamp while preserving the business row ID and can move the row.
- Refresh history/counts after mutations. Switching Newest/Oldest changes the
  React Query ordering variant and returns the mobile list to the top. An
  uncached variant fetches page 1; a cached variant may restore previously loaded
  pages. Format `last_vouched_at` for the business row and nested `created_at` for
  individual endorsements as ISO timestamps in the user's timezone.

This document adds the backend API contract and handoff. Any maintained external
API collection/catalog and frontend integration documentation should add this
route when the frontend task begins. No additional documentation source was
identified as required for this change.

## Validation

Executed from `sugbogo_backend/` using the existing Windows backend virtual
environment and configured test database:

```powershell
.\venv\Scripts\python.exe manage.py test apps.explorer_operations.explore_businesses.views.tests.test_vouch_history_views apps.business.services.tests.test_vouch_service apps.explorer_operations.explore_businesses.views.tests.test_business_vouch_views --noinput
```

Task 1 result: **51 tests passed**, 0 failures, 0 errors, in **78.383 seconds**.
This comprises 27 updated/expanded history tests and all 24 existing vouch
service/API regression tests. The runner created and destroyed a separate test
database; no development database migration or data update was performed.

Verified coverage includes:

- One business row for multiple specialty endorsements, preserving duplicate
  rejection, individual IDs/timestamps, reaction flags and stored counters.
- Full-history business/endorsement totals, including off-page businesses, empty
  results and exclusion of other users, suspended businesses and retired tags.
- Latest eligible endorsement ordering for both directions, business-ID ties,
  always-newest-first nested endorsements and vouch-ID ties.
- Default/max page sizes, complete endorsements within a single business page,
  and SQL business pagination before relation prefetches.
- Removing one endorsement versus the last, recreation of individual vouches,
  business identity remaining stable and re-vouching changing business order.
- Deletion, suspension/restoration, specialty deactivation/reactivation and
  exclusion of retired/latest or other users' endorsements from ordering.
- Authentication including bearer JWT, active Explorer/Merchant permissions,
  user isolation and preservation of scoring-invalid evidence visibility.

Populated pages use **5 database queries** under forced authentication: business
count, ordered business page with joined category, current specialty-tag prefetch,
eligible endorsement prefetch with joined specialty, and one full-history totals
aggregate. Query assertions passed for one and multiple businesses, proving no
per-business/per-endorsement query growth. The paginated retrieval check also
confirmed SELECT-only queries. JWT adds its normal authentication read; the
five-query claim excludes it. No production-scale SQL timing benchmark was run.

Additional checks executed successfully:

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
git diff --check
```

Django system check: no issues. Migration drift check: `No changes detected`.
Diff whitespace check: passed. No dependencies, application settings, models,
constraints, mutation services or scoring logic changed. `MapView.tsx` retained
the exact same SHA-256 hash before and after this task.

The earlier per-specialty implementation's 43-test run is historical; the results
above validate the grouping change. The full backend suite and live
frontend/provider/worker integration were not run. No changes were staged,
committed or pushed at that implementation-validation stage. Task 1 was later
committed as `680a49adc432804f5137a28240fdd2d594bd11c0`
(`refactor: group vouch history by business`).

## Task 2 mobile integration (2026-10-11)

The existing Explorer Profile > Your Activity > Vouch History entry and
`src/app/(explorer)/profile/vouch-history.tsx` route now render a production
server-backed screen. No route/layout changes were necessary. Backend behavior,
dependencies and authentication infrastructure are unchanged.

The implementation follows the mobile architecture and UI/UX skills and the
repository instructions. Relevant [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/),
[Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/) and
[Image](https://docs.expo.dev/versions/v57.0.0/sdk/image/) documentation was read
before implementation.

### Mobile files

All paths in this table are relative to `sugbogo_frontend/mobile/`.

| File | Change and responsibility |
| --- | --- |
| `src/features/profile/screens/VouchHistoryScreen.tsx` | Modified: summary, server ordering, business pages, refresh, request recovery, persistent business selection and screen-owned mutation/pending protection. |
| `src/features/profile/components/vouch-history/VouchHistoryItem.tsx` | Modified: business identity/photo fallback, all returned endorsements, latest date, business navigation and three-dot Manage Vouch action. |
| `src/features/explore/hooks/useBusinessVouch.tsx` | Modified: adds history and review-cache invalidation to the existing mutation settlement; mutation requests, optimistic updates and rollback remain unchanged. |
| `src/features/profile/types/vouchHistory.types.ts` | Created: exact grouped history, endorsement, ordering and summary response types using existing business field types. |
| `src/features/profile/api/vouchHistory.service.ts` | Created: typed history GET using the existing authenticated API client and request wrapper. |
| `src/features/profile/hooks/vouchHistoryQueryKeys.ts` | Created: stable history prefix with authenticated user ID and ordering variants. |
| `src/features/profile/hooks/useVouchHistory.ts` | Created: infinite query, server page order, complete summary and distinct request states. |
| `src/features/profile/components/vouch-history/ManageVouchBottomSheet.tsx` | Created: selected business, current detail query, existing reactions, screen-supplied pending/action state, retry, dismissal and Android back handler. |
| `src/features/profile/components/vouch-history/VouchHistorySkeleton.tsx` | Created: initial history placeholders using shared Skeleton. |
| `src/features/profile/components/vouch-history/VouchHistoryEmptyState.tsx` | Created: successful empty-history guidance using existing mascot and text components. |
| `src/features/profile/__tests__/vouchHistory.fixtures.ts` | Created: typed history/detail/page fixtures shared by focused tests. |
| `src/features/profile/api/__tests__/vouchHistory.service.test.ts` | Created: endpoint, ordering/page parameters and request-error normalization tests. |
| `src/features/profile/hooks/__tests__/useVouchHistory.test.tsx` | Created: authentication gating, account/order cache separation, pagination, totals and error recovery tests. |
| `src/features/profile/screens/__tests__/VouchHistoryScreen.test.tsx` | Created: screen states, ordering, navigation, persistent sheet, independent mutations, back-handler lifecycle and mutation recovery tests using real query/mutation hooks. |
| `src/features/explore/hooks/__tests__/vouchHistoryCache.test.tsx` | Created: history/review invalidation, existing POST/DELETE use, optimistic state, pending state and cache rollback tests. |
| `src/features/profile/components/vouch-history/EditVouchModal.tsx` | Deleted: obsolete single-tag replacement prototype. Its sole consumer was the replaced mock history screen; no references remain. |

This handoff document is also modified. No other backend files changed for
Task 2. The pre-existing `MapView.tsx` modification is excluded and remains
unstaged; its SHA-256 is still
`4160478F1A905E4D3B61200BEA7AE9B94B76DB30F6B239CF1A4D661D601B48A1`.

### Data and interaction behavior

- History calls `/explorer/explore/vouch-history/` through the existing client
  base URL, with `ordering` and `page`. It uses the backend's default page size
  of 10; there is no client page-size selector or user-selection parameter.
- Query keys are `["explorer-vouch-history", userId, ordering]`. The authenticated
  user ID separates caches; it is not sent as a request parameter. Requests are
  disabled until the user ID is available.
- Cards use the business ID and show every `vouches[]` specialty. They display
  `last_vouched_at` with the existing date formatter. No client sorting or
  truncation of endorsements is performed.
- The two summary values come from the first loaded page's full-history
  `summary`, never from loaded item or endorsement counts.
- Newest/Oldest changes the query variant and returns the scroll position to the
  top. The backend remains responsible for both business and endorsement order.
- Initial skeleton, successful empty state, initial Retry, refresh recovery,
  next-page Lottie loading and next-page Retry are distinct. Refresh/next-page
  failures preserve loaded rows. Failed next pages require explicit Retry rather
  than repeated automatic requests; concurrent page/refresh requests are guarded.
- The three-dot action opens Manage Vouch directly. There is no bulk removal,
  local search or specialty-switch replacement action.
- Manage Vouch is mounted by the screen, outside FlatList rows. A selected
  business snapshot supplies identity during detail loading; reaction flags and
  counts come from `useExploreBusinessProfile` under the existing business-detail
  key. Partial history rows are never written into the detail cache.
- Existing `BusinessSpecialtyVouchCard` and `useBusinessVouch` handle independent
  toggles. The screen owns the mutation hook, synchronous request guard and
  pending business ID; dismissing/unmounting the sheet does not reset them.
  Reopened sheets keep their reactions disabled until the original request and
  settlement callbacks finish, whether it succeeds or fails. The business ID
  passed to the mutation hook remains pinned to that request during settlement,
  even if selection is cleared or another business is selected. The protection
  is local to this screen's Manage Vouch flow, not a global application lock.
  Owner restrictions and unavailable-detail recovery are preserved.
- Removing one endorsement retains the card if others remain. Removing the last
  removes the history card after refetch, but never dismisses the sheet. The
  business detail still permits adding another specialty until the user closes
  the sheet. Re-vouching adopts the backend's new vouch ID/timestamp and order.
- Close, backdrop/swipe dismissal and Android back dismiss the sheet. The back
  listener is registered only while open and removed on closure/unmount.

### Cache synchronization

The existing optimistic changes to business detail, new businesses, discovery,
recommendations, discovery results, Similar Places and collection caches remain
intact, including rollback and existing recommendation/list ordering behavior.

Mutation settlement now also invalidates the complete history prefix and the
business's `business-review-preview` / `business-reviews` prefixes, including
filtered review variants containing current `vouched_specialties`. Existing
business-detail, new-business and discovery invalidation remains intact.
Active matching queries refetch; inactive variants become stale for their next
use. History rows and totals are not synthesized optimistically: successful
server reads determine eligibility, original IDs, timestamps and page order.

### Historical Task 2 validation (2026-10-11)

Executed from `sugbogo_frontend/mobile/` using installed dependencies:

```powershell
.\node_modules\.bin\jest.cmd --runInBand --watch=false --runTestsByPath src/features/profile/api/__tests__/vouchHistory.service.test.ts src/features/profile/hooks/__tests__/useVouchHistory.test.tsx src/features/profile/screens/__tests__/VouchHistoryScreen.test.tsx src/features/explore/hooks/__tests__/vouchHistoryCache.test.tsx src/features/explore/hooks/__tests__/similarBusinessCache.test.tsx src/features/explore/hooks/__tests__/visibilityHooks.test.tsx src/features/profile/screens/__tests__/ProfileInterestsEntry.test.tsx
```

Initial result before the pending-request lifecycle fix: **46 tests passed**,
0 failed, across **7 suites**, in **19.742 seconds**.
This includes 32 new tests (3 API, 6 history hook, 19 screen/management, 4 cache)
and 14 existing regression tests. The combined runner initially warned that
asynchronous work remained after the assertions finished, then exited with
code **0** when polled later. The cause of that delay was not established.
An isolated run of all four new suites with `--detectOpenHandles` passed all
**32 tests**, exited with code **0**, and reported no open handles, in
**39.399 seconds**. No `--forceExit` workaround was used.

Screen tests retain real history, detail and mutation hooks while mocking API
responses, native image/animation rendering, list scrolling and sheet transitions.
They verify removal of one versus the last endorsement, persistent selection,
re-vouching, backend reorder, rollback and repeat-press protection. Android back
handler registration/dismissal/cleanup is unit tested; actual OS interaction is
not validated by these mocks.

At that validation stage, the whole-project command
`.\node_modules\.bin\tsc.cmd --noEmit --incremental false --pretty false`
exited **1** with **40 diagnostics**. The historical validation report recorded
matching pre-implementation diagnostics and no new errors in changed/new files.
Issues at that stage included generated route types, stale test imports/fixtures,
registration location types and missing installed module declarations. The global
type check failed then; the current result is recorded below.

Targeted ESLint on all 15 new/modified TypeScript files passed with **0 errors,
0 warnings**. Prettier check passed for all 14 new/modified profile and test
files; the existing mutation hook's unrelated formatting was preserved.
`git diff --check` passed after the documentation update. Final scope checks
found only the listed Task 2 files plus the pre-existing unstaged `MapView.tsx`
change. The Git index is empty and HEAD remains the Task 1 commit above.

At that implementation-validation stage, real authenticated API integration,
native sheet presentation/swipe/backdrop transitions, Android back dispatch,
safe areas, large system text and scroll position required device verification.
No full frontend/backend suite, native build or live backend/device integration
was run at that stage. Subsequent APK testing is recorded below. The page-number
concurrency limits described above remain. Explicit logout clears QueryClient;
the pre-existing token-expiration path does not explicitly clear all server
caches, so history deliberately uses user-scoped keys without refactoring auth.

Nothing is staged, committed or pushed for Task 2. Backend mutation behavior,
database models/constraints/scoring, dependencies, routes and `MapView.tsx` are
unchanged by this task.

### Pending-request lifecycle fix (2026-10-11)

The final review found that dismissing Manage Vouch unmounted its local pending
guard and mutation observer. Reopening it while an earlier request was still
running could therefore permit a conflicting specialty action.

The screen now owns `useBusinessVouch`, the synchronous request guard and the
pending business ID. The sheet receives the pending state and toggle callback.
Its dismissal still clears selection and unmounts the sheet, while the mutation
and protection remain alive in the mounted screen. The original business ID
stays pinned through mutation/settlement so existing rollback and invalidation
callbacks retain their correct target. Success/error feedback is unchanged and
interaction becomes available again after success or failure. This introduces
no global lock and makes no changes to the shared mutation hook or backend.

Only four existing Task 2 working-tree files changed for this fix:

- `src/features/profile/screens/VouchHistoryScreen.tsx`: persistent mutation
  ownership, request guard, business target and existing toast/error handling.
- `src/features/profile/components/vouch-history/ManageVouchBottomSheet.tsx`:
  delegates mutations and uses screen-supplied pending state; retains current
  business-detail, ownership/error guards and native dismissal behavior.
- `src/features/profile/screens/__tests__/VouchHistoryScreen.test.tsx`: three
  lifecycle regression cases; the uninterrupted-session repeat-press test remains.
- This handoff document: corrected ownership/protection description and actual
  fix validation results. Mobile paths above are relative to
  `sugbogo_frontend/mobile/`.

The delayed-success and delayed-failure reopen tests both failed against the
previous implementation because reactions were enabled after reopening. They
now verify blocked conflicting requests, settlement, correct detail/history
state, failure feedback and a subsequent successful specialty action. A third
case checks correct business-cache invalidation when settlement happens while
the sheet remains closed.

Validation from `sugbogo_frontend/mobile/`:

```powershell
.\node_modules\.bin\jest.cmd --runInBand --watch=false --detectOpenHandles --runTestsByPath src/features/profile/api/__tests__/vouchHistory.service.test.ts src/features/profile/hooks/__tests__/useVouchHistory.test.tsx src/features/profile/screens/__tests__/VouchHistoryScreen.test.tsx src/features/explore/hooks/__tests__/vouchHistoryCache.test.tsx src/features/explore/hooks/__tests__/similarBusinessCache.test.tsx src/features/explore/hooks/__tests__/visibilityHooks.test.tsx src/features/profile/screens/__tests__/ProfileInterestsEntry.test.tsx
.\node_modules\.bin\tsc.cmd --noEmit --incremental false --pretty false
.\node_modules\.bin\eslint.cmd src/features/profile/screens/VouchHistoryScreen.tsx src/features/profile/components/vouch-history/ManageVouchBottomSheet.tsx src/features/profile/screens/__tests__/VouchHistoryScreen.test.tsx
.\node_modules\.bin\prettier.cmd --check src/features/profile/screens/VouchHistoryScreen.tsx src/features/profile/components/vouch-history/ManageVouchBottomSheet.tsx src/features/profile/screens/__tests__/VouchHistoryScreen.test.tsx
git diff --check
```

- The combined run completed its assertions with **49 tests passed**, 0 failed,
  across **7 suites**, in **55.835 seconds**. This includes 35 Task 2 tests
  (22 screen tests) and 14 existing regressions. The combined process initially
  lingered after the assertions, then exited with code **0** when polled later.
  The cause of that cleanup delay was not established.
- An isolated run of all four Task 2 suites with the same options and
  `--detectOpenHandles` passed **35 tests**, 0 failed, in **22.237 seconds**,
  exited **0** and reported no open handles. No `--forceExit` was used.
- The initial focused post-fix run passed the three lifecycle regressions plus
  the existing uninterrupted repeat-press case: **4 passed**, 18 intentionally
  skipped, exit **0**.
- At this historical fix-validation stage, TypeScript exited **1** with
  **40 diagnostics**. The fix report recorded matching before/after outputs
  and no new diagnostics. This is not the current diagnostic count; the global
  type-check failure remains unresolved.
- Targeted ESLint exited **0**, with no errors/warnings. Prettier check passed
  for all three changed TypeScript files. Diff whitespace check passed,
  including the handoff changes.

The guard is scoped to the mounted Vouch History screen's Manage Vouch flow;
other app screens are not globally locked. At that fix-validation stage, native
dismissal/reopening under slow success/failure, Android back/swipe/backdrop
behavior and authenticated device/API integration had not been manually verified.
No native build or full application suite was run. The earlier multi-page and
sort-in-flight automated coverage gaps were outside this focused fix; subsequent
manual multi-page results are recorded below.

No files were created or deleted by this fix. Scope/hash checks found only the
four files above changed from the start of the fix. `MapView.tsx` retained the
same recorded SHA-256 and remains unstaged. Nothing was staged, committed or
pushed; HEAD remains the Task 1 commit.

## Final validation and APK testing (2026-10-14)

These results describe the latest reported runs and developer testing in this
session. They supersede earlier current-state descriptions without replacing
the historical validation records above, and do not guarantee future runs.

### Mobile automated validation

From `sugbogo_frontend/mobile/`, the seven targeted Jest suites were rerun using
`--runInBand --watch=false --detectOpenHandles --runTestsByPath` and the same
seven paths listed in the fix-validation command above. **7 suites and 49 tests
passed**, zero failures/skips, exit **0**, with a Jest-reported test duration of
**20.602 seconds**. No snapshots or open-handle warnings were reported. The
process exited normally after a several-minute cleanup delay whose cause remains
unexplained; no `--forceExit` was used. Delayed success/failure across sheet
dismissal/reopening, settlement against the original business while dismissed
and uninterrupted repeat-press protection all passed.

- Targeted ESLint passed on **15 Task 2 TypeScript files**, zero errors/warnings,
  exit **0**, without autofix.
- Prettier `--check` passed on **14 files**, exit **0**, without writing files.
  `src/features/explore/hooks/useBusinessVouch.tsx` was excluded because of its
  known unrelated formatting differences; this check does not certify that
  file's formatting. `MapView.tsx` was excluded from both targeted checks.
- `.\node_modules\.bin\tsc.cmd --noEmit --incremental false --pretty false`
  exited **1** with **25 diagnostics across 16 files unchanged from HEAD**.
  None were reported in the 15 Task 2 TypeScript files. This is 15 fewer than the
  historical 40. Stale interest-hook imports and a missing required `icon` in
  an existing Similar Places fixture were verified in HEAD. The original
  diagnostic-by-diagnostic baseline was unavailable, so the exact membership
  changes and cause of the count reduction were not independently established.
  No new Task 2 diagnostic was identified; the whole-project type check fails.

The final backend regression run also passed **124 tests**, including 27 seeder
tests and 97 existing regressions, in **238.855 seconds**, exit **0**. System,
migration consistency and whitespace checks passed. Database isolation and
development-record preservation are recorded in the
[seeder validation report](development-business-listings-seeder.md).

### Completed manual APK testing

Developers reported these scenarios passed using the installed Android
development APK with Metro and the local backend:

- Business-grouped history, all current endorsements and full-history summary
  counts, with the expected business information and latest-vouched date.
- Adding/removing specialties through business profiles and Manage Vouch;
  multiple endorsements remain grouped in one business card.
- Removing the final endorsement removes the card while the sheet stays usable;
  re-vouching from that open sheet restores the business.
- Newest/Oldest ordering, including multi-page order, and pull-to-refresh of
  multiple pages without missing or duplicate business cards.
- The default page size is 10 businesses. With an 11th business, backend logs
  confirmed page 1 and page 2 returned HTTP 200 and all 11 businesses were
  accessible without duplicates. Additional specialties did not consume more
  business pagination slots.
- Removing one of two endorsements changed totals from 11 businesses / 12
  endorsements to 11 / 11; removing the final endorsement then changed them
  to 10 / 10, while the remaining businesses stayed accessible.

### Remaining optional device verification

Network-error recovery and delayed mutations with sheet dismissal/reopening have
not been manually verified on the phone. Automated tests cover the relevant
request-state and pending-protection cases; native behavior for those scenarios
still needs optional device verification. No additional native gesture, safe-area
or large-text certification is implied by the completed scenarios above. Existing
page-number concurrency limits and automated sort-in-flight coverage gaps remain.
