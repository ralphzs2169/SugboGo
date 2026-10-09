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
- Refresh history/counts after mutations and reset pagination when ordering
  changes. Format `last_vouched_at` for the business row and nested `created_at`
  for individual endorsements as ISO timestamps in the user's timezone.

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
committed or pushed for Task 1.
