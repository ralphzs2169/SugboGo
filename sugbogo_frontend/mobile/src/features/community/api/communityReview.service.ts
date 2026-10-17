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
  const params = new URLSearchParams();
  params.set("page", String(page));

  if (filters.ordering !== "newest") {
    params.set("ordering", filters.ordering);
  }
  if (filters.clusterId !== null) {
    params.set("cluster", String(filters.clusterId));
  }
  for (const categoryId of [...new Set(filters.categoryIds)].sort(
    (a, b) => a - b,
  )) {
    params.append("category", String(categoryId));
  }
  if (filters.specialtyTagId !== null) {
    params.set("specialty_tag", String(filters.specialtyTagId));
  }
  if (filters.hasPhotos) {
    params.set("has_photos", "true");
  }

  return request(apiClient.get("/reviews/community/", { params }));
}
