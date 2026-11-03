# Admin All Reviews API

## Architecture and scope

The directory is implemented as read-only service, serializer, view, and URL modules
inside the existing Admin moderation feature. It reads `Review`, `ReviewPhoto`,
`ReviewReport`, `User`, `Business`, category/cluster relations, and `AdminActivity`.
It does not change Explorer/Merchant serializers, publication, sentiment processing,
Discovery Score, report thresholds, or moderation decisions. No schema change is needed.

The audit found four `Review.ReviewStatus` values: `published`, `under_review`,
`flagged`, and `rejected`. Reports independently use `pending`, `approved`, `rejected`,
and `withdrawn`. `REVW_REPORT_COUNT` is a stored counter; the directory instead counts
the existing relational report records. Admin users already have access to user names,
emails, avatars, and business identities through user/business management.

Existing moderation detail endpoints are eligibility-limited: under-review detail
accepts held or previously manually moderated reviews; grouped reported-review detail
requires at least one pending report. Neither serves as a directory detail for every
status. Existing report drawers omit reporter identity, and this drawer preserves that
privacy convention. Decision history already exists in `AdminActivity` JSON context;
there is no complete revision ledger for every review edit or automated transition.

Existing Admin lists use `StandardPagination`; dashboard and analytics summary reads
have separate endpoints. The directory follows those conventions with a separate
summary request, avoiding repeated metric aggregation on each search/page request.
Existing Admin analytics uses Manila calendar dates; directory submission-date filters
use the same timezone, independently of analytics reporting-period presets.

## Endpoints

| Method | Path | Django URL name |
| --- | --- | --- |
| GET | `/api/admin/reviews/` | `admin-all-review-list` |
| GET | `/api/admin/reviews/summary/` | `admin-all-review-summary` |
| GET | `/api/admin/reviews/<review_id>/` | `admin-all-review-detail` |

All three require `IsAuthenticated` and the existing
`HasRole(User.UserRole.ADMIN, User.UserRole.SUPER_ADMIN)`. Active Admin and Super Admin
users can inspect every retained review regardless of review/business/author status.
Anonymous requests return 401 with default JWT authentication; other roles and inactive
Admins return 403. Missing reviews return 404. No new role or permission mechanism is
introduced. Mutation methods return 405 for an authorized caller.

Errors use the existing `success: false` envelope and exception handler. Invalid
supported filters return 400 with `errors`; out-of-range pages return 404.

## Metric definitions and response

```json
{
  "success": true,
  "message": "Review summary retrieved successfully.",
  "data": {
    "total_reviews": 42,
    "published": 30,
    "under_review": 5,
    "reported": 8
  }
}
```

- `total_reviews`: all retained `Review` rows, including flagged and rejected reviews.
- `published`: rows whose current `REVW_STATUS` equals `published`.
- `under_review`: rows whose current `REVW_STATUS` equals `under_review`.
- `reported`: distinct retained reviews with **any retained report**, including pending,
  approved, rejected, and withdrawn reports. Multiple reports on one review count once.

These are global inventory counts, unaffected by list filters or pagination. A
published or under-review review may also be reported. The four cards are not a
partition and must not be summed. Reported is a historical-presence directory measure;
the Moderation/dashboard pending reported-review workload has a different definition.
Deleted reviews do not remain in this inventory; the existing deletion audit is separate.

## List contract

```json
{
  "success": true,
  "message": "Success.",
  "data": {
    "items": [
      {
        "id": 123,
        "text": "The complete stored review text.",
        "author": {
          "id": 7,
          "first_name": "Example",
          "last_name": "Reviewer",
          "role": "explorer",
          "avatar_url": null,
          "avatar_key": null,
          "name": "Example Reviewer",
          "email": "reviewer@example.com"
        },
        "business": {
          "id": 9,
          "name": "Example business",
          "cover_photo_url": null,
          "category_name": "Restaurants",
          "cluster_name": "Food and Dining"
        },
        "status": "published",
        "submitted_at": "2026-10-11T00:00:00Z",
        "first_photo_url": null,
        "photo_count": 0,
        "report_count": 2,
        "pending_report_count": 1
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total_items": 42,
      "total_pages": 5,
      "has_next": true,
      "has_previous": false
    }
  }
}
```

The author contract extends `ReviewAuthorResponseSerializer` with Admin-visible `name`
and `email`. `avatar_key` retains the existing fallback avatar convention. Media URLs
may be null or blank when no uploaded image is stored. `first_photo_url` is null when
no review photo exists; otherwise it is the photo with the lowest `RPHO_ID`.
`photo_count` counts all attached photos. `report_count` counts all retained reports,
while `pending_report_count` counts only pending records. Counts do not depend on
stored counters or a report-attention threshold. Text is complete (currently at most
1,000 characters), so the table can choose its own visual truncation.

## Query parameters

| Parameter | Values and behavior |
| --- | --- |
| `search` | Trimmed, case-insensitive substring, maximum 200 characters; review text, author first/last/full name/email, or business name |
| `status` | `published`, `under_review`, `flagged`, `rejected`; omit for all |
| `reported` | `true` / `false`; same all-retained-report definition as the Reported card |
| `start_date` | Optional inclusive submission calendar date, `YYYY-MM-DD`, Asia/Manila |
| `end_date` | Optional inclusive submission calendar date, `YYYY-MM-DD`, Asia/Manila |
| `ordering` | `newest` (default) or `oldest`; submission timestamp then review ID in the same direction |
| `page` | Existing page-number pagination; default 1 |
| `page_size` | Existing `StandardPagination` behavior; default 10, maximum 100 |

Filters combine with AND; search fields combine with OR. Dates may be supplied
independently. A reversed date range is invalid; `9999-12-31` is rejected as an end
date because the SQL exclusive upper bound requires the following day. The end date
becomes midnight of the following Manila day with an exclusive comparison. Filtering
uses `REVW_CREATED_AT`, not publication or last update time. The summary endpoint
does not consume list query parameters.

## Detail contract

The detail response is `{"success": true, "message": "Review retrieved successfully.",
"data": <detail>}`. `<detail>` contains **every list-item field above**, plus:

```json
{
  "photos": [
    {"id": 1, "photo_url": "https://example.com/review.jpg"}
  ],
  "reports": [
    {
      "id": 10,
      "type": "spam",
      "status": "pending",
      "created_at": "2026-10-11T03:00:00Z",
      "admin_notes": null,
      "explanation": "Optional reporter explanation.",
      "updated_at": "2026-10-11T03:00:00Z",
      "withdrawn_at": null
    }
  ],
  "updated_at": "2026-10-11T04:00:00Z",
  "edited_at": null,
  "published_at": "2026-10-11T00:01:00Z",
  "sentiment": {"label": "positive", "score": 0.75},
  "moderation": {
    "outcome": "safe",
    "provider_unavailable": false,
    "checked_at": "2026-10-11T00:01:00Z"
  },
  "history": [
    {
      "id": 20,
      "action": "review_report_rejected",
      "created_at": "2026-10-11T04:00:00Z",
      "actor": {"id": 2, "first_name": "Example", "last_name": "Admin"},
      "previous_review_status": "published",
      "review_status": "published",
      "notes": "Existing recorded administrator decision notes."
    }
  ],
  "moderation_links": {
    "under_review": null,
    "reported_review": "/api/admin/review-reports/reviews/123/",
    "review_dispute": null
  }
}
```

Photos are ordered by ascending ID. Reports include all statuses, ordered by creation
time and ID descending. Report `type` is the existing reason code: `spam`, `abuse`,
`misinformation`, `off_topic`, `private_information`, or `other`. No reporter/account/
installation identity is exposed. Report explanations and existing decision notes are
already Admin-visible in the grouped report inspection contract.

`updated_at` is the model's general update time, not proof of an author edit. Use
nullable `edited_at` for the actual recorded edit time. `published_at` is nullable for
held and historical rows. Sentiment label/score are stored values, nullable if no
analysis is available; the score is sentiment, not a manual star rating. Automated
moderation `outcome` is `safe`, `flagged`, `provider_failure`, or null if unrecorded or
unrecognized. `provider_unavailable` also accounts for stored incomplete checks.
`checked_at` is the stored check timestamp or null. These findings can predate a
manual decision: current `status` remains authoritative.

History contains only existing manual hold, individual report, grouped report, and
merchant dispute decision actions linked by `AACT_CONTEXT.review_id`, newest first.
Missing historic states/notes remain null; no history is fabricated. Raw activity
context, snapshots, integrity/device flags, installation IDs, provider payloads, and
model metadata are omitted. Empty history, reports, and photos are arrays.

## Moderation integration for frontend Task 2

- Fetch the summary independently from the paginated list. Refresh it after returning
  from a moderation decision when fresh cards are needed.
- Compute row number as `(page - 1) * page_size + index + 1`.
- Use `moderation_links` returned by detail to decide whether Open in Moderation is
  applicable; null means that destination is unavailable. Multiple can be present.
- `under_review` uses existing `admin-under-review-detail` for currently held reviews
  **or** reviews with a recorded manual hold decision, including already resolved ones.
- `reported_review` uses existing `admin-reported-review-detail` only while pending
  reports remain, even if the review itself is already rejected. Historical reported
  presence alone does not make this action applicable.
- `review_dispute` uses existing `admin-review-dispute-detail` with the existing case
  ID when the review has a pending merchant dispute. Resolved disputes remain in
  the existing Moderation history and no longer produce this pending-case link.
- These are API detail paths, not invented browser routes. Map their existing review
  IDs to the application's established Moderation navigation. Decision buttons and
  writes stay in the existing Moderation workflow, which revalidates current state.
- The All Reviews page has no approve/reject/publish endpoint. Links and counts may
  change between requests; existing moderation errors handle stale state.
- Render neutral fallbacks for absent images/analysis/history. Do not derive sentiment
  or status from report totals, AI outcomes, or card totals.

## Query strategy and verification

Summary uses one filtered aggregate over Review with a correlated report `EXISTS`;
there is no report join to duplicate reviews. List uses `select_related` for author,
business, category, and cluster, plus scalar subqueries for media/report counts and
thumbnail. Report filtering uses `EXISTS`; all filtering, ordering, and pagination
happen in SQL. Investigation JSON and installation fields are deferred on the list.
No per-row API requests, media prefetches, AI calls, or analytics-provider calls occur.

With the service/serializer boundary isolated, summary is one SQL query, list rows
are one SQL query (plus the paginator count in a paginated request), and detail is
four queries: review/identity/scalars, photos, reports, and decision history/actors.
Middleware/authentication may add their existing queries. Counts stay constant as
rows and related records grow. Arbitrary substring search uses the existing
`icontains` pattern; no new search index or migration is introduced. Detail returns
all existing reports/history for the selected review, rather than paginating them.
Summary, list, and detail are separate live reads, without cross-request snapshot
guarantees.

Focused tests are in
`apps/admin_operations/moderation/views/tests/test_all_review_views.py` and cover
roles, inactive/anonymous denial, all metric definitions and overlap, empty results,
authoritative row counts, optional media, every search/filter/order, Manila date
boundaries, validation, pagination, full detail, report privacy, stored analysis,
history, existing moderation links/decisions, read-only behavior, and bounded queries.
Run these alongside the existing reported-review, under-review, and individual report
view tests to check the original workflows.

Validation on 2026-11-03: all 63 tests passed (26 new directory tests and 37 existing
moderation API tests). The run used a separate disposable PostgreSQL/PostGIS database,
`test_sugbogo_all_reviews_20261103`, and a test-only MD5 fixture password hasher;
production authentication settings were unchanged. The database was destroyed after
the passing run. `manage.py check`, Python compilation, and
`manage.py makemigrations --check --dry-run` also passed, with no migration changes.

The focused test modules are:

```text
apps.admin_operations.moderation.views.tests.test_all_review_views
apps.admin_operations.moderation.views.tests.test_reported_review_views
apps.admin_operations.moderation.views.tests.test_manage_under_review_views
apps.admin_operations.moderation.views.tests.test_manage_review_report_views
```

## Exact files changed for this task

```text
config/urls.py
apps/admin_operations/moderation/all_review_urls.py
apps/admin_operations/moderation/services/all_review_service.py
apps/admin_operations/moderation/serializers/all_review_serializers.py
apps/admin_operations/moderation/views/all_review_views.py
apps/admin_operations/moderation/views/tests/test_all_review_views.py
docs/admin-all-reviews-api-contract.md
```

No frontend files, model definitions, migrations, or existing decision implementations
were changed by this task. No commit was created.
