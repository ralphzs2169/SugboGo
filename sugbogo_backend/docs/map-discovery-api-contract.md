# Explorer map discovery

`GET /api/explorer/explore/map/`

Requires an authenticated active Explorer or Merchant, matching the existing
discovery feed. Only businesses eligible for that feed are returned: the business
must be active; verification is not required. The existing `map-preview/` endpoint
and Explore response contracts are unchanged.

## Request

| Parameter | Required | Meaning |
| --- | --- | --- |
| `north` | Yes | Northern latitude, between -90 and 90. |
| `south` | Yes | Southern latitude, between -90 and 90. |
| `east` | Yes | Eastern longitude, between -180 and 180. |
| `west` | Yes | Western longitude, between -180 and 180. |
| `page` | No | Standard page number, starting at 1. |
| `page_size` | No | Standard positive page size, capped at the configured marker limit. |

Coordinates must be finite. North must exceed south and east must exceed west.
Zero-area, inverted, and antimeridian-crossing viewports are rejected. By default,
neither latitude nor longitude span may exceed 0.5 degrees. Invalid bounds return
HTTP 400 with the existing `VALIDATION_ERROR` envelope and field errors; oversized
viewports use the `bounds` error key. The client should zoom in after this error.

For example:

```text
/api/explorer/explore/map/?north=10.4&south=10.2&east=124.0&west=123.8
```

Results use the registered location's 4326 point. Points on viewport edges and
corners are included. The endpoint applies no fixed-radius restriction. Search,
cluster, category, and specialty query parameters are not supported in this scope.

## Response

```json
{
  "success": true,
  "message": "Success.",
  "data": {
    "items": [
      {
        "id": 42,
        "business_name": "Example Cafe",
        "cover_photo_url": null,
        "display_cover_photo_url": "https://example.com/storefront.jpg",
        "cluster": {
          "id": 1,
          "name": "Culinary",
          "icon": "coffee"
        },
        "category": {
          "id": 3,
          "name": "Cafe"
        },
        "location": {
          "address": "Example Street",
          "city": "Cebu City",
          "province": "Cebu",
          "latitude": 10.3,
          "longitude": 123.9
        },
        "specialty_tags": [
          {
            "id": 5,
            "name": "Local Coffee",
            "color": "blue",
            "icon": "coffee"
          }
        ],
        "is_hidden_gem": true
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 200,
      "total_items": 1,
      "total_pages": 1,
      "has_next": false,
      "has_previous": false
    }
  }
}
```

Coordinates and display address follow the existing nested `location` contract.
`display_cover_photo_url` uses the shared cover/storefront fallback. Both image
fields may be null. Only active specialty assignments appear, without vouch state
or internal scores. Empty viewports return HTTP 200 with an empty `items` list,
zero totals, and `has_next: false`, following `StandardPagination`.

## Global Hidden Gems

`DiscoveryFeedService.list_ranked_businesses()` shares eligibility, persisted-score
ordering, and the creation-time/ID tie-breakers with the existing discovery feed.
`list_global_hidden_gem_ids()` selects the first 10 IDs without geographic or
taxonomy filters. Missing scores retain the feed's zero fallback.

The map uses this ID query in an uncorrelated SQL subquery to annotate
`is_hidden_gem`; it does not issue a ranking query for every marker. A business
outside the global Top 10 never becomes a gem because higher-ranked businesses
are outside the viewport. Later filters must apply only to the outer map queryset.
Map requests do not recompute or persist scores, and responses expose no scores or
calculation details. Explorer UI should display the label **Hidden Gem**.

## Limits and query behavior

Deployment settings, also listed in `.env.example`:

- `MAP_DISCOVERY_MAX_MARKERS`: default 200, positive integer; default and maximum
  page size for this endpoint only.
- `MAP_DISCOVERY_MAX_VIEWPORT_SPAN`: default 0.5, positive finite degrees up to
  180; maximum permitted span on either axis.

Markers are ordered by gem status first, then business ID ascending. Each page is
bounded before serialization; `total_items`, `total_pages`, and `has_next` describe
the complete matching viewport. If `has_next` is true, the current page is partial.
Clients must either fetch subsequent pages for the same bounds or ask the user to
zoom in; they must not label the first page as every business in the area.

The query uses PostGIS intersection with a 4326 rectangle and the existing spatial
index on `LOCATION.LOCT_POINT`. No new field or migration is required. Selected
location, category, and cluster fields are joined; active specialty labels are
prefetched once; cover fallback uses the shared SQL expression. A nonempty page
uses three database queries: total count, marker rows including the gem subquery,
and specialty prefetch. Empty pages need only the count query.

Dense viewports still require a matching-row count and deterministic sort. There
is no server clustering or snapshot token. Daily score refreshes and business
changes can shift page contents between requests, so clients should deduplicate
IDs when accumulating pages. Future work can add search/taxonomy narrowing to the
lazy geographic queryset, measure large-data query plans, and tune the caps.
