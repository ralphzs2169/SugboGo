import { z } from "zod";
import { businessRatingSchema } from "./businessRatingSchema";

import type { QueryPersistencePolicy } from "@/shared/query/queryPersistencePolicies";
import {
  DISCOVERY_FEED_QUERY_KEY,
  NEW_BUSINESSES_QUERY_KEY,
  RECOMMENDATIONS_QUERY_KEY,
  DISCOVERY_SHORTCUTS_QUERY_KEY,
  EXPLORE_SPECIALTIES_QUERY_KEY,
  EXPLORE_FILTER_OPTIONS_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
  EXPLORE_FILTER_RETENTION_MS,
  EXPLORE_HOMEPAGE_ITEM_LIMIT,
} from "../constants/exploreHomepageQueries";

const id = z.number().int().positive();
const count = z.number().int().nonnegative();
const color = z.enum(["blue", "green", "purple", "yellow", "red", "teal"]);
const cluster = z.object({ id, name: z.string(), icon: z.string() });
const category = z.object({ id, name: z.string() });
const specialty = z.object({
  id,
  name: z.string(),
  color,
  icon: z.string(),
});

// Explicit DTO projections strip unknown fields at every level. Detail, review,
// moderation and operational payloads cannot hitchhike in a homepage response.
const business = z.object({
  sentiment_rating: businessRatingSchema.nullable().optional().catch(undefined),
  is_hidden_gem: z.boolean().optional(),
  id,
  business_name: z.string(),
  cover_photo_url: z.string().nullable(),
  display_cover_photo_url: z.string().nullable(),
  review_count: count,
  overall_vibe: z
    .enum(["mostly_positive", "mostly_neutral", "mostly_negative", "mixed"])
    .nullable(),
  is_pocketed: z.boolean(),
  cluster,
  category,
  specialty_tags: z.array(
    z.object({
      id,
      name: z.string(),
      color,
      icon: z.string().nullable(),
      vouch_count: count,
      is_vouched: z.boolean(),
    }),
  ),
  location: z.object({
    address: z.string(),
    city: z.string(),
    province: z.string(),
    latitude: z.number().finite(),
    longitude: z.number().finite(),
  }),
});
const recommendation = business.extend({
  recommendation_reason: z
    .object({
      type: z.enum(["specialty_tag", "category", "cluster"]),
      id,
      label: z.string(),
    })
    .nullable(),
});
const pagination = z.object({
  page: z.literal(1),
  page_size: count,
  total_items: count,
  total_pages: count,
  has_next: z.boolean(),
  has_previous: z.literal(false),
});

function feedSchema(item: typeof business | typeof recommendation) {
  return z.object({
    items: z
      .array(z.unknown())
      .transform((items) => items.slice(0, EXPLORE_HOMEPAGE_ITEM_LIMIT))
      .pipe(z.array(item)),
    pagination,
  });
}

function policy(
  key: readonly [string],
  schema: z.ZodType,
  maxAgeMs = EXPLORE_HOMEPAGE_RETENTION_MS,
): QueryPersistencePolicy {
  return {
    id: key[0],
    version: key[0] === DISCOVERY_FEED_QUERY_KEY[0] ? 2 : 1,
    kind: "query",
    // Exact identity excludes filtered/paginated variants, even with this prefix.
    matches: (candidate) => candidate.length === 1 && candidate[0] === key[0],
    maxAgeMs,
    maxBytes: 512 * 1024,
    parse: (data) => schema.parse(data),
  };
}

export const EXPLORE_HOMEPAGE_PERSISTENCE_POLICIES: readonly QueryPersistencePolicy[] =
  Object.freeze([
    policy(DISCOVERY_FEED_QUERY_KEY, feedSchema(business)),
    policy(NEW_BUSINESSES_QUERY_KEY, feedSchema(business)),
    policy(
      RECOMMENDATIONS_QUERY_KEY,
      feedSchema(recommendation).extend({
        is_personalized: z.boolean().optional(),
      }),
    ),
    policy(
      DISCOVERY_SHORTCUTS_QUERY_KEY,
      z.array(
        z.object({
          id,
          title: z.string(),
          subtitle: z.string(),
          business_count: count,
          cluster,
        }),
      ),
    ),
    policy(
      EXPLORE_SPECIALTIES_QUERY_KEY,
      z.array(specialty.extend({ business_count: count })),
    ),
    // Full compatible DTO is required: homepage renders clusters from this query,
    // while the same query contract also supplies categories/specialties to filters.
    policy(
      EXPLORE_FILTER_OPTIONS_QUERY_KEY,
      z.object({
        clusters: z.array(cluster),
        categories: z.array(category.extend({ cluster_id: id })),
        specialty_tags: z.array(specialty),
      }),
      EXPLORE_FILTER_RETENTION_MS,
    ),
  ]);
