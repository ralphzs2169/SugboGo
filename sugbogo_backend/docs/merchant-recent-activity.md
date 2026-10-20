# Merchant Recent activity API

`GET /api/merchant/dashboard/recent-activity/`

Requires an authenticated merchant with an owned business. No Merchant Plus
entitlement is required. Business scope comes exclusively from authentication.
The endpoint accepts no query parameters, including reporting periods, business
IDs, pagination, limits, or historical cutoffs.

The response uses the standard success envelope. `data.items` contains at most
five rows across all three sources, sorted by `occurred_at` descending. No
activity is fabricated to fill the section. Equal timestamps prefer reviews,
then vouches, then saves; reviews and vouches use descending source IDs for
stable ordering. Each source query is bounded to five candidate rows/groups.

## Example response

```json
{
  "success": true,
  "message": "Recent business activity retrieved successfully.",
  "data": {
    "business": { "id": 42, "name": "Example business", "status": "active" },
    "items": [
      {
        "id": "review:123",
        "type": "review",
        "occurred_at": "2026-10-20T12:30:00+08:00",
        "date": "2026-10-20",
        "time_basis": "published_at",
        "title": "Angela Cruz left a review",
        "description": "Friendly staff and beautifully made gifts.",
        "actor_name": "Angela Cruz",
        "count": 1,
        "specialties": [],
        "remaining_specialties": 0,
        "target": { "type": "business_review", "id": 123 }
      },
      {
        "id": "vouch:7:2026-10-20",
        "type": "vouch",
        "occurred_at": "2026-10-20T12:00:00+08:00",
        "date": "2026-10-20",
        "time_basis": "latest_vouch",
        "title": "Miguel Santos vouched for 2 specialties",
        "description": "Handmade Crafts, Locally Made",
        "actor_name": "Miguel Santos",
        "count": 2,
        "specialties": [
          { "id": 8, "name": "Handmade Crafts" },
          { "id": 9, "name": "Locally Made" }
        ],
        "remaining_specialties": 0,
        "target": null
      },
      {
        "id": "save:2026-10-20",
        "type": "save",
        "occurred_at": "2026-10-20T11:30:00+08:00",
        "date": "2026-10-20",
        "time_basis": "latest_save",
        "title": "4 explorers saved your business",
        "description": "",
        "actor_name": null,
        "count": 4,
        "specialties": [],
        "remaining_specialties": 0,
        "target": null
      }
    ],
    "snapshot_as_of": "2026-10-20T12:31:00+08:00",
    "is_partial": false,
    "timezone": "Asia/Manila",
    "grouping": { "vouches": "explorer_day", "saves": "day" },
    "sources": {
      "saves": {
        "availability": "available",
        "coverage": "recorded_events_only"
      }
    }
  }
}
```

## Source semantics

- Reviews: currently published reviews only. Future publication timestamps are
  excluded. Publication through `ReviewService` now stores the first publication
  time, including held reviews approved later. Historical rows without that
  timestamp use their creation time and declare `created_at_fallback`; edits do
  not bump activity. Excerpts normalize whitespace and are at most 160 characters.
- Vouches: surviving, valid evidence on currently active specialty assignments,
  grouped by explorer and Manila calendar day. Suspicion flags alone do not
  invalidate evidence. `count` is distinct specialties; at most three specialty
  names/IDs are returned, with `remaining_specialties` for overflow. The timestamp
  is the latest eligible vouch in the group. This daily grouping intentionally
  differs from the inbox's one-minute unread grouping.
- Saves: recorded Mongo `SAVE` events, grouped by Manila day and distinct explorer.
  Repeated records from the same explorer/day do not inflate the count. Timestamp
  is the last observed save in that day. No saver IDs, names, or destinations are
  exposed. Unsaving does not remove a recorded historical save event. Recording
  is best effort; `recorded_events_only` does not promise complete coverage.

Reads do not use, create, or modify notifications. Reading an inbox item does not
change this timeline. This is a current source-derived snapshot, not a permanent
audit ledger: deleted/unpublished reviews and removed/invalidated vouches can
disappear. There is no dependency on the Overview date filter or inbox read state.

## Frontend integration

- Use each row's stable `id` as its key.
- Render `title`, optional `description`, and the timestamp/date. Use `date` and
  the response timezone for labels such as “Today”. Do not display the Overview
  period above this section.
- Only rows with a non-null `target` are navigable. A `business_review` target
  reuses the existing Merchant Reviews specific-review flow. Informational rows
  need no chevron, new screen, or read/unread control.
- When `sources.saves.availability` is `unavailable`, SQL rows still return with
  HTTP 200 and `is_partial: true`. Show a compact save-tracking availability note;
  do not claim zero saves or a fully empty timeline from that response.
- Other database/request failures remain API errors, rather than fabricated empty
  snapshots. A healthy empty result returns `items: []` and `is_partial: false`.

The publication timestamp requires the generated reviews migration. Legacy
timestamps are intentionally not backfilled with invented publication dates.
