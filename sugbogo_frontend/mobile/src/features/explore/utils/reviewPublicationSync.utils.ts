import type { QueryClient } from "@tanstack/react-query";

import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { ACTIVITY_TIMELINE_QUERY_KEY } from "@/features/profile/hooks/activityTimelineQueryKeys";
import { myReviewsKey } from "@/features/profile/hooks/myReviewQueryKeys";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "../hooks/reviewQueryKeys";
import {
  cancelBusinessCardCollections,
  invalidateBusinessCardCollections,
} from "./reviewCache.utils";
import type { BusinessReview } from "../types/review.types";

import { beginBusinessRatingSync } from "../hooks/businessRatingSync";
import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";

const observedDecisions = new WeakMap<QueryClient, Set<string>>();
const observedSentiment = new WeakMap<QueryClient, Map<string, string>>();

/** Refresh inclusion transitions once across the existing review observers. */
export async function refreshAuthorReviewSentiment(
  client: QueryClient,
  businessId: number,
  userId: number,
  review: BusinessReview,
) {
  const identity = `${getAuthSessionGeneration()}:${userId}:${businessId}:${review.id}`;
  let observed = observedSentiment.get(client);
  if (!observed) {
    observed = new Map();
    observedSentiment.set(client, observed);
  }
  if (review.sentiment_aggregate_included !== true) {
    observed.delete(identity);
    return;
  }
  const source = JSON.stringify([
    review.text,
    review.sentiment_label,
    review.sentiment_score,
  ]);
  if (observed.get(identity) === source) return;
  observed.set(identity, source);
  await refreshAuthorReviewReads(client, businessId, userId);
}

/** Refresh a confirmed author decision once across preview and history observers. */
export async function refreshAuthorReviewDecision(
  client: QueryClient,
  businessId: number,
  userId: number,
  reviewId: number,
  status: "published" | "rejected",
) {
  const identity = `${getAuthSessionGeneration()}:${userId}:${reviewId}:${status}`;
  let observed = observedDecisions.get(client);
  if (!observed) {
    observed = new Set();
    observedDecisions.set(client, observed);
  }
  if (observed.has(identity)) return;
  observed.add(identity);
  const baseline = client.getQueryData<ExploreBusinessDetail>(
    exploreBusinessDetailKey(businessId),
  )?.sentiment_rating;
  if (status === "published" && baseline) {
    const generation = getAuthSessionGeneration();
    await Promise.all([
      cancelBusinessCardCollections(client),
      client.cancelQueries({ queryKey: exploreBusinessDetailKey(businessId) }),
    ]);
    if (generation !== getAuthSessionGeneration()) return;
    beginBusinessRatingSync(client, businessId, baseline);
  }
  await refreshAuthorReviewReads(client, businessId, userId);
}

/** Refresh consumers after observed publication or newly persisted sentiment. */
export async function refreshAuthorReviewReads(
  client: QueryClient,
  businessId: number,
  userId: number,
) {
  await Promise.all([
    invalidateBusinessCardCollections(client),
    ...[
      businessReviewPreviewKey(businessId),
      businessReviewsKey(businessId),
      exploreBusinessDetailKey(businessId),
      myReviewsKey(userId),
      ACTIVITY_TIMELINE_QUERY_KEY,
      COMMUNITY_REVIEWS_QUERY_KEY,
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  ]);
}
