import type { BusinessReview } from "@/features/explore/types/review.types";
import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import {
  MERCHANT_REVIEW_PAGE_SIZE,
  type MerchantReviewLocation,
} from "../types/merchantReviews.types";

/** Locates a published review in the authenticated merchant's own business feed. */
export function getMerchantReviewLocation(
  businessId: number,
  reviewId: number,
): Promise<ApiResponse<MerchantReviewLocation>> {
  return request(
    apiClient.get(`/reviews/business/${businessId}/focus/${reviewId}/`, {
      params: { page_size: MERCHANT_REVIEW_PAGE_SIZE },
    }),
  );
}

/** Reads one published review with server-side merchant ownership checks. */
export function getMerchantReviewDetail(
  businessId: number,
  reviewId: number,
): Promise<ApiResponse<BusinessReview>> {
  return request(
    apiClient.get(`/reviews/business/${businessId}/merchant/${reviewId}/`),
  );
}
