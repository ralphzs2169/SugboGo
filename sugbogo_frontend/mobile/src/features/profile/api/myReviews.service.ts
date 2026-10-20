import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  MyReviewPage,
  MyReviewFilter,
  MyReviewOrdering,
} from "../types/myReview.types";

/** Retrieves the authenticated author's history; identity is resolved server-side. */
export function getMyReviews(
  page = 1,
  status: MyReviewFilter = "all",
  ordering: MyReviewOrdering = "newest",
): Promise<ApiResponse<MyReviewPage>> {
  return request(
    apiClient.get("/reviews/mine/", { params: { page, status, ordering } }),
  );
}
