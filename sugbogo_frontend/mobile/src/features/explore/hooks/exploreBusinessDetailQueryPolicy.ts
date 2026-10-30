import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";
import { resolveReviewInsightRegeneration } from "../utils/reviewInsightRegeneration.utils";

export const EXPLORE_BUSINESS_DETAIL_STALE_TIME_MS = 5 * 60_000;

/** Reuse ordinary detail reads while allowing unfinished insights to recover. */
export function exploreBusinessDetailStaleTime(
  detail: ExploreBusinessDetail | null | undefined,
) {
  const progress = resolveReviewInsightRegeneration(
    detail?.review_insight_regeneration,
    detail?.review_insights,
  );
  if (
    detail?.sentiment_rating?.state === "pending" ||
    detail?.sentiment_rating?.state === "unavailable" ||
    progress?.is_outstanding ||
    detail?.review_insights?.state === "pending" ||
    detail?.review_insights?.state === "outdated"
  ) {
    return 0;
  }

  return EXPLORE_BUSINESS_DETAIL_STALE_TIME_MS;
}
