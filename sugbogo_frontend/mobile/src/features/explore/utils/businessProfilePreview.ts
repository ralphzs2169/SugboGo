import type { QueryClient, QueryKey } from "@tanstack/react-query";
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
  if (Array.isArray(data)) {
    yield* data;
  } else if (data && typeof data === "object") {
    if ("items" in data && Array.isArray(data.items)) {
      yield* data.items;
    } else if ("pages" in data && Array.isArray(data.pages)) {
      for (const page of data.pages) {
        if (page && Array.isArray(page.items)) yield* page.items;
      }
    }
  }
}

/** Reads known listing shapes once per profile opening, newest matching cache first. */
export function resolveBusinessProfilePreview(
  client: QueryClient,
  businessId: number,
  ownerId: number,
): BusinessProfilePreview | null {
  if (!Number.isSafeInteger(businessId) || businessId <= 0) return null;

  const queries = client
    .getQueryCache()
    .findAll({ predicate: (query) => isListingKey(query.queryKey, ownerId) })
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
