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
import { invalidateBusinessCardCollections } from "./reviewCache.utils";

const observedDecisions = new WeakMap<QueryClient, Set<string>>();

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
