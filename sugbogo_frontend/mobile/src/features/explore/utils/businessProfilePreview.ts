import {
  hashKey,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { z } from "zod";

import {
  DISCOVERY_FEED_QUERY_KEY,
  NEW_BUSINESSES_QUERY_KEY,
  OPEN_NOW_BUSINESSES_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
} from "../constants/exploreHomepageQueries";

const previewSchema = z.object({
  id: z.number().int().positive().safe(),
  business_name: z.string().min(1),
  display_cover_photo_url: z.string().nullable(),
  cluster: z.object({ id: z.number(), name: z.string(), icon: z.string() }),
  category: z.object({ id: z.number(), name: z.string() }),
});

/** Listing identity only. This cannot stand in for business detail or permission state. */
export type BusinessProfilePreview = z.infer<typeof previewSchema>;

// Exact lookups avoid QueryCache.getAll/findAll, which copy the entire cache.
// One source hint plus five fixed keys means at most six queries are inspected.
export const BUSINESS_PROFILE_PREVIEW_LIMITS = {
  queries: 6,
  pagesPerQuery: 4,
  itemsPerPage: 50,
  itemsPerQuery: 200,
  queryHashLength: 2048,
} as const;

const listingFamilies = new Set<unknown>([
  DISCOVERY_FEED_QUERY_KEY[0],
  NEW_BUSINESSES_QUERY_KEY[0],
  OPEN_NOW_BUSINESSES_QUERY_KEY[0],
  RECOMMENDATIONS_QUERY_KEY[0],
  "explore-discovery-results",
  "explore-collections",
  "similar-businesses",
]);

function isListingKey(key: QueryKey, ownerId: number) {
  return (
    listingFamilies.has(key[0]) ||
    (key[0] === "map-discovery-directory" &&
      (key[1] === "all" || key[1] === "business")) ||
    (key[0] === "pockets" &&
      key[1] === ownerId &&
      key[2] === "collections" &&
      key[4] === "businesses")
  );
}

function* listingItems(data: unknown): Generator<unknown> {
  const limits = BUSINESS_PROFILE_PREVIEW_LIMITS;
  let items: unknown = null;
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object" && "items" in data) {
    items = data.items;
  }

  if (Array.isArray(items)) {
    const count = Math.min(items.length, limits.itemsPerQuery);
    for (let index = 0; index < count; index += 1) {
      yield items[index];
    }
  } else if (
    data &&
    typeof data === "object" &&
    "pages" in data &&
    Array.isArray(data.pages)
  ) {
    // Prefer recently reached pages without walking earlier, possibly huge histories.
    const start = Math.max(0, data.pages.length - limits.pagesPerQuery);
    for (let index = start; index < data.pages.length; index += 1) {
      const page = data.pages[index];
      if (!page || !Array.isArray(page.items)) continue;
      const count = Math.min(page.items.length, limits.itemsPerPage);
      for (let item = 0; item < count; item += 1) {
        yield page.items[item];
      }
    }
  }
}

/** Reads a fixed set of known listing shapes, newest matching cache first. */
export function resolveBusinessProfilePreview(
  client: QueryClient,
  businessId: number,
  ownerId: number,
  sourceQueryHash?: string,
): BusinessProfilePreview | null {
  if (!Number.isSafeInteger(businessId) || businessId <= 0) return null;

  const hashes = new Set([
    hashKey(DISCOVERY_FEED_QUERY_KEY),
    hashKey(NEW_BUSINESSES_QUERY_KEY),
    hashKey(RECOMMENDATIONS_QUERY_KEY),
    hashKey(["map-discovery-directory", "all"]),
    hashKey(["map-discovery-directory", "business", businessId]),
  ]);
  if (
    typeof sourceQueryHash === "string" &&
    sourceQueryHash.length <= BUSINESS_PROFILE_PREVIEW_LIMITS.queryHashLength
  ) {
    hashes.add(sourceQueryHash);
  }
  const cache = client.getQueryCache();
  const queries = [...hashes]
    .map((hash) => cache.get(hash))
    .filter(
      (query): query is Query =>
        query !== undefined && isListingKey(query.queryKey, ownerId),
    )
    .sort(
      (left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt,
    );

  for (const query of queries) {
    for (const item of listingItems(query.state.data)) {
      if (!item || typeof item !== "object" || !("id" in item)) continue;
      if (item.id !== businessId) continue;
      // Strip every non-identity field, including Pocket, review and moderation state.
      const parsed = previewSchema.safeParse(item);
      if (parsed.success) return parsed.data;
    }
  }
  return null;
}
