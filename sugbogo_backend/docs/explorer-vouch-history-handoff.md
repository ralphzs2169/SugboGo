# Explorer specialty vouch history handoff

Date: 2026-10-09 (Asia/Manila)

## Scope and confirmed decisions

The user selected one history entry per active **specialty vouch**, preserving
the existing multiple-specialty behavior. A business can appear more than once.
This feature adds a read-only list; it changes no models, constraints, migrations,
vouch mutations, scoring, or frontend files.

## Files

Paths below are relative to `sugbogo_backend/`.

| File | Change and responsibility |
| --- | --- |
| `apps/explorer_operations/explore_businesses/services/vouch_history_service.py` | Created: user-scoped visible-vouch queryset, chronology, eager loading and tag annotations. |
| `apps/explorer_operations/explore_businesses/serializers/vouch_history_serializers.py` | Created: ordering validation and history response mapping. |
| `apps/explorer_operations/explore_businesses/views/vouch_history_views.py` | Created: permissions, query validation, standard pagination and serialization. |
| `apps/explorer_operations/explore_businesses/urls.py` | Modified: registers `vouch-history`, under the existing Explorer prefix. |
| `apps/explorer_operations/explore_businesses/views/tests/test_vouch_history_views.py` | Created: API, mutation compatibility, visibility, pagination and query-count tests. |
| `docs/explorer-vouch-history-handoff.md` | Created: API contract, implementation findings and developer handoff. |

No files were deleted. The pre-existing frontend `MapView.tsx` working-tree change
was left untouched.

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

## Endpoint and response contract

`GET /api/explorer/explore/vouch-history/`

Route name: `vouch-history`. Requires `Authorization: Bearer <access_token>` and
an active authenticated user with the Explorer or Merchant role. Merchant access
matches the existing Explorer business detail and vouch endpoints. Admin and
Super Admin roles do not grant access.

| Query parameter | Behavior |
| --- | --- |
| `ordering` | `newest` by default; accepts `oldest`. Other values return HTTP 400 with `VALIDATION_ERROR` and `errors.ordering`. |
| `page` | Existing page-number pagination, starting at 1. Invalid or out-of-range pages return HTTP 404. |
| `page_size` | Existing default 10 and maximum 100; uses `StandardPagination` parsing and fallback behavior. |

There is no user-selection parameter: the query always uses `request.user`.
Newest orders by creation timestamp descending, then vouch ID descending;
oldest uses both fields ascending. This resolves equal timestamps deterministically.

The following example uses illustrative IDs and timestamps. All returned keys
are shown; there is no separate top-level count or `business` wrapper.

```json
{
  "success": true,
  "message": "Success.",
  "data": {
    "items": [
      {
        "id": 101,
        "business_id": 12,
        "business_name": "History Bistro",
        "cover_photo_url": "https://example.com/history-cover.jpg",
        "category": {"id": 3, "name": "History Restaurants"},
        "specialty": {
          "id": 7,
          "name": "History Spicy",
          "color": "red",
          "icon": "utensils"
        },
        "created_at": "2026-10-09T01:00:00Z",
        "specialty_tags": [
          {"id": 7, "name": "History Spicy", "color": "red", "icon": "utensils", "vouch_count": 2, "is_vouched": true},
          {"id": 8, "name": "History Traditional", "color": "blue", "icon": "chef_hat", "vouch_count": 0, "is_vouched": false},
          {"id": 9, "name": "History Cozy", "color": "green", "icon": "heart", "vouch_count": 0, "is_vouched": false}
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total_items": 1,
      "total_pages": 1,
      "has_next": false,
      "has_previous": false
    }
  }
}
```

`id` identifies the vouch row, not the business or specialty. `total_items` counts
all matching currently visible specialty vouches, including those outside this
page. Empty history returns `items: []`, page 1, `total_items: 0`, `total_pages: 0`
and both navigation flags false, following the existing paginator.

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
the list and `total_items`. Their vouches are not deleted by this read endpoint.

Normal merchant submission/classification flows require three active specialty
tags. History serializes the actual active assignment set, ordered by assignment
ID; it does not invent, truncate or repair tags if legacy data has another count.
`vouch_count` is the existing stored assignment counter, not a scoring-evidence
count or a value recalculated during this request.

Pagination is deterministic for unchanged data, but uses the existing page-number
contract. Concurrent additions/removals can shift pages; no snapshot/cursor
guarantee is introduced. Query-count tests exclude authentication database reads
by using forced authentication; a separate test exercises actual bearer JWT.

No critical product questions remain after the user selected per-specialty
entries. No live frontend, external service or worker validation is included.

## Frontend handoff and documentation

- Use the vouch `id` as the row key, since `business_id` can repeat.
- Read the history badge total from `data.pagination.total_items`.
- Render `specialty` as the entry's endorsement, and `specialty_tags` as the
  business's current selection with user-specific flags and stored counts.
  Multiple tags may have `is_vouched: true`.
- Resolve icon and color tokens through the existing frontend mapping; icon
  values are names such as `chef_hat`, and color values are names such as `red`.
- Provide the existing image fallback for null or blank `cover_photo_url`.
- Continue using the existing POST/DELETE endpoint with the entry's
  `business_id` and `specialty.id` as `tag_id`. DELETE requires its JSON body.
- Refresh history/counts after mutations and reset pagination when ordering
  changes. Treat `created_at` as an ISO timestamp and format it for the user.

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

Result: **43 tests passed**, 0 failures, 0 errors, in 78.914 seconds. This includes
19 new history tests and all 24 existing vouch service/API tests. The runner
created and destroyed its separate test database; the development database was
not migrated or overwritten. No application configuration or dependencies changed.

New coverage includes unauthenticated requests and bearer JWT; role/status access;
request-user isolation even with a supplied user ID; exact business, specialty,
timestamp, count and flag payloads; null cover photos; multiple specialties and
duplicate rejection through existing POST; timestamp/ID ordering across pages;
default/max page size and complete pagination totals; empty results and invalid
input; existing DELETE/recreation; business suspension/deletion; assignment
deactivation/reactivation; scoring-invalid evidence visibility; and constant
query counts with multiple businesses and vouches.

Both populated-page query assertions passed at **3 database queries** (count,
joined vouch page, annotated active-specialty prefetch). An empty page need not
perform the prefetch. The pre-implementation vouch baseline also passed all 24
tests, and Django's system check reported no issues.

All selected tests ran successfully. The unrelated full backend suite and live
frontend/provider/worker integration were not run.
