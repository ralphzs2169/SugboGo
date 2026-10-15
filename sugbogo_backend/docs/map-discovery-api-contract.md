# Explorer map discovery

## Global map directory

`GET /api/explorer/explore/map/businesses/`

This additive endpoint supplies all publicly eligible businesses through bounded
pages, independently of camera position. It has the same Explorer/Merchant
permissions, active-business eligibility, compact `items` serializer, pagination
envelope, photo fallback, and global `is_hidden_gem` annotation as the viewport
endpoint below. Verification is not required. No location or service-area
rectangle is required; eligibility is not restricted to the current viewport.

Supported optional parameters are `page`, `page_size`, `cluster`, repeated
`category`, `specialty_tag`, `hidden_gems`, `open_now`, and `business`, with the
same filter validation and semantics documented below. Default and maximum page
size use `MAP_DISCOVERY_MAX_MARKERS` (200 by default). Results are ordered by
business ID ascending, independently of gem status, to keep pagination stable
across score changes. The viewport endpoint retains its gem-first ordering.

Shared queryset construction retains joined locations/taxonomy, active specialty
prefetching, SQL cover fallback, and the global gem subquery. A nonempty directory
page uses three queries, including the total count. `open_now` reuses the existing
Asia/Manila weekly-hours SQL calculation; schedules are not downloaded to mobile.

### Mobile directory loading and freshness

Map Discovery requests every page until `has_next` is false, deduplicating IDs.
The loader verifies page progression, consistent totals, and the final unique
record count. Only a complete download replaces the React Query cache. Later-page
failures or detected directory changes expose Retry and retain any previous
complete snapshot; no first page is presented as the complete directory.

The directory has a five-minute stale time. Cluster/category/specialty and Hidden
Gems filters run locally with category OR and cross-filter AND semantics. Active
specialties and gem membership remain server-authoritative. Applying or clearing
these filters, and panning/zooming the map, never reload the directory. There is
no Search this area action or oversized-viewport message in the directory UI.

Open Now loads every page with `open_now=true` and separately caches the eligible
business IDs. Its stale time is 30 seconds with a 60-second refresh interval while
enabled, screen-focused, and app-active. Polling stops after errors and while
inactive; stale queries refresh on returning. Loading or refresh failures are
shown separately from empty filtered results. Turning the filter off restores
the complete directory without another base request while the cache is fresh.

Global text search continues to use Explore discovery. Selections resolve from
the unfiltered directory, with an unfiltered `business=<id>` directory lookup
when missing from the cache. A search selection may remain visible despite map
filters and is merged once by ID. Unavailable businesses clear selection with a
message. Camera readiness/layout, selected-marker clustering exclusion, and
preview navigation are independent of directory loading.

Page-number pagination is not a cross-request snapshot. Stable ordering and
client consistency checks reduce omissions but cannot detect every concurrent
insert/delete combination. A snapshot/version or cursor contract remains future
work if directory size or churn warrants it. Open Now reflects stored weekly
hours, not holiday exceptions or live merchant presence.

## Viewport endpoint (preserved)

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
| `cluster` | No | Positive cluster ID; same taxonomy semantics as Explore. |
| `category` | No | Repeated positive category IDs, e.g. `category=3&category=4`. |
| `specialty_tag` | No | Positive specialty ID; only active assignments match. |
| `hidden_gems` | No | Boolean, default false; restrict to the globally determined Top 10. |
| `open_now` | No | Boolean, default false; match the stored weekly schedule in Asia/Manila. |
| `business` | No | Positive business ID for a compact selection lookup within the supplied bounds. |

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
corners are included. The endpoint applies no fixed-radius restriction. Taxonomy
filters reuse Explore validation and `apply_taxonomy_filters`; categories are ORed
within the category list, while cluster, category, specialty, and quick filters
intersect. No filter changes global Hidden Gem membership or map ordering.

Global text search uses the existing `/api/explorer/explore/discovery/?search=...`
endpoint, independent of map bounds and map filters. It matches registered active
business names, categories, clusters, and active specialties with existing Explore
relevance ordering. Text search is not a viewport-map parameter.

`open_now` evaluates Asia/Manila weekly hours at request time. Opening time is
inclusive and closing time exclusive. Today’s 24-hour schedule matches all day;
ordinary overnight schedules include the previous day’s spillover, including
Sunday into Monday. Closed, missing, incomplete, and equal-time ordinary schedules
do not assert availability. This describes stored weekly hours; no holiday or live
merchant-presence data exists. SQL `Exists` avoids per-business schedule queries.

`business` is used without taxonomy/quick filters to resolve a selected global
search result even if ordinary map pagination or active filters exclude it. Bounds,
active-business eligibility, and global gem annotation still apply. Clients should
identify a separately pinned search selection rather than implying it matches
the active filters. This does not fetch a full business profile.

There is no `new` filter: the current New Businesses collection orders all active
businesses by creation date, without a recency eligibility cutoff. Near Me remains
the map’s existing locate control.

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
IDs when accumulating pages. Future work can measure large-data query plans and
tune the caps; map filters continue to narrow the lazy geographic queryset.
