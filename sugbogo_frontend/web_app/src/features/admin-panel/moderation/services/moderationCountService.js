import { fetchReviewDisputes } from "../../review-disputes/services/reviewDisputeService";
import { fetchReportedReviews } from "../../reported-reviews/services/reportedReviewService";
import { fetchSuspiciousReviews } from "../../suspicious-reviews/services/suspiciousReviewService";
import { fetchUnderReviewReviews } from "../../under-review/services/underReviewService";

const COUNT_PARAMS = { page: 1, page_size: 1 };

const COUNT_REQUESTS = {
  "under-review": () => fetchUnderReviewReviews(COUNT_PARAMS),
  suspicious: () => fetchSuspiciousReviews(COUNT_PARAMS),
  reported: () => fetchReportedReviews(COUNT_PARAMS),
  disputes: () => fetchReviewDisputes({ ...COUNT_PARAMS, status: "pending" }),
};

/** Read the total number of cases from the matching paginated queue. */
export async function fetchModerationTabCount(tabId) {
  const response = await COUNT_REQUESTS[tabId]();
  const total = response?.pagination?.total_items;

  if (!Number.isInteger(total) || total < 0) {
    throw new Error("Moderation queue count is unavailable.");
  }

  return total;
}
