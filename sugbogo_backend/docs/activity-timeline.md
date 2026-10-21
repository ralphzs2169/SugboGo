# Explorer activity timeline

`GET /api/explorer/explore/activity-timeline/`

Requires bearer authentication and an active Explorer or Merchant account. The
owner is always the authenticated user; request parameters cannot select another
account.

## Query parameters

| Parameter | Values | Default |
| --- | --- | --- |
| `activity_type` | `all`, `saves`, `vouches`, `reviews` | `all` |
| `page` | Standard page number | `1` |
| `page_size` | Standard page size, up to 100 | `10` |

The response uses the existing `success`, `message`, and `data` envelope.
`data.items` contains entries and `data.pagination` contains standard pagination
metadata. Invalid activity filters return 400; invalid pages return 404.

```json
{
  "id": "vouch:42",
  "type": "vouch",
  "source_id": 42,
  "occurred_at": "2026-10-20T14:30:00Z",
  "business": {
    "id": 7,
    "business_name": "Example Cafe",
    "status": "active",
    "display_cover_photo_url": "https://example.com/cover.jpg"
  },
  "specialty": {
    "id": 3,
    "name": "Coffee",
    "color": "teal",
    "icon": "coffee"
  },
  "review": null
}
```

Entry types are singular: `save`, `vouch`, and `review`. IDs are namespaced by
type so IDs from different source tables do not collide. `specialty` is populated
only for vouches. `review` is populated only for reviews and contains `id`,
`excerpt` (up to 180 characters), `status`, and nullable `edited_at`. No internal
moderation diagnostics are exposed.

Business covers use the dedicated cover photo, falling back to the first usable
storefront photo, or `null` if neither exists. Specialty color and icon values
reuse the existing specialty chip contract.

## Current-activity semantics

- Saves use the unique user/business record, not collection memberships. Saving
  the same business in several Pockets produces one entry; moving it between
  Pockets preserves its original timestamp. Only active businesses are shown.
- Vouches are individual specialty endorsements and reuse existing vouch-history
  eligibility: active businesses and active business/specialty assignments.
- Reviews retain the author's private visibility across all review statuses and
  business statuses. Clients should use the business status to avoid navigating
  to unavailable public business pages.
- Creation timestamps determine chronology. Editing a review updates its current
  excerpt and edit date without creating an event or moving its submission date.
- Removing the underlying action removes the entry. This endpoint is not a
  permanent event log. Existing records appear without a backfill or migration.

The database combines eligible rows with `UNION ALL` and orders them before
pagination by creation timestamp descending, type ascending (`review`, `save`,
`vouch`), then source ID descending. Equal timestamps therefore have deterministic
ordering. Standard page-number pagination is not a snapshot: concurrent additions
or removals can shift page boundaries; clients should refresh after mutations.
