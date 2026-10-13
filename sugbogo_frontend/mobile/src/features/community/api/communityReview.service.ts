import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
  type CommunityReviewListResponse,
} from "../types/communityReview.types";

/** Retrieves one backend-ordered page of public Community reviews. */
export function getCommunityReviews(
  filters: CommunityReviewFilters = DEFAULT_COMMUNITY_REVIEW_FILTERS,
  page = 1,
): Promise<ApiResponse<CommunityReviewListResponse>> {
  const params: Record<string, string> = {
    page: String(page),
  };

  if (filters.ordering !== "newest") {
    params.ordering = filters.ordering;
  }
  if (filters.clusterId !== null) {
    params.cluster = String(filters.clusterId);
  }
  if (filters.hasPhotos) {
    params.has_photos = "true";
  }

  return request(apiClient.get("/reviews/community/", { params }));
}
