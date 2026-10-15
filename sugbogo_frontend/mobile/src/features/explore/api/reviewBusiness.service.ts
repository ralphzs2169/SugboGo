import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { getInstallationId } from "@/shared/api/storage.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  BusinessReviewFilters,
  BusinessReviewListResponse,
  BusinessReviewPreview,
  BusinessReview,
  LocalReviewPhoto,
  ReviewCreateResult,
} from "../types/review.types";

function appendPhotos(form: FormData, photos: LocalReviewPhoto[]) {
  photos.forEach((photo, index) => {
    form.append("photos", {
      uri: photo.uri,
      name: photo.fileName ?? `review-${index}.jpg`,
      type: photo.mimeType ?? "image/jpeg",
    } as never);
  });
}

function reviewForm(
  text: string | undefined,
  photos: LocalReviewPhoto[],
  keepPhotoIds?: number[],
  showInCommunity?: boolean,
) {
  const form = new FormData();

  if (text !== undefined) {
    form.append("text", text);
  }

  if (showInCommunity !== undefined) {
    form.append("show_in_community", String(showInCommunity));
  }

  if (keepPhotoIds?.length === 0) {
    // An empty repeated field would otherwise be indistinguishable from omission.
    form.append("keep_photo_ids", "[]");
  } else {
    keepPhotoIds?.forEach((id) => {
      form.append("keep_photo_ids", String(id));
    });
  }

  appendPhotos(form, photos);

  return form;
}

export function getBusinessReviewPreview(
  businessId: number,
): Promise<ApiResponse<BusinessReviewPreview>> {
  return request(apiClient.get(`/reviews/business/${businessId}/`));
}

export function getAllBusinessReviews(
  businessId: number,
  filters?: BusinessReviewFilters,
  page = 1,
  pageSize?: number,
): Promise<ApiResponse<BusinessReviewListResponse>> {
  const url = `/reviews/business/${businessId}/all/`;
  const params: Record<string, string> = {
    page: String(page),
  };

  if (pageSize) {
    params.page_size = String(pageSize);
  }

  if (filters?.sentiment) {
    params.sentiment = filters.sentiment;
  }
  if (filters?.topic) {
    params.topic = filters.topic;
  }
  if (filters?.hasPhotos) {
    params.has_photos = "true";
  }
  if (filters?.merchantReplied) {
    params.merchant_replied = "true";
  }
  if (filters?.ordering && filters.ordering !== "newest") {
    params.ordering = filters.ordering;
  }

  return request(apiClient.get(url, { params }));
}

export async function createReview(
  businessId: number,
  text: string,
  photos: LocalReviewPhoto[],
  showInCommunity?: boolean,
): Promise<ApiResponse<ReviewCreateResult>> {
  let installationId: string;

  try {
    installationId = await getInstallationId();
  } catch {
    throw new Error(
      "Unable to access this app's installation ID. Please try again.",
    );
  }

  const form = reviewForm(text, photos, undefined, showInCommunity);
  form.append("installation_id", installationId);

  return request(
    apiClient.post(
      `/reviews/business/${businessId}/`,
      form,
    ),
  );
}

export function updateReview(
  reviewId: number,
  text: string | undefined,
  photos: LocalReviewPhoto[],
  keepPhotoIds?: number[],
  showInCommunity?: boolean,
): Promise<ApiResponse<BusinessReview>> {
  return request(
    apiClient.patch(
      `/reviews/${reviewId}/`,
      reviewForm(text, photos, keepPhotoIds, showInCommunity),
    ),
  );
}

export function deleteReview(
  reviewId: number,
): Promise<ApiResponse<{ review_id: number }>> {
  return request(apiClient.delete(`/reviews/${reviewId}/`));
}

export function deleteReviewPhoto(photoId: number) {
  return request(apiClient.delete(`/reviews/photos/${photoId}/`));
}

export type ReviewLikeResult = {
  review_id: number;
  is_liked: boolean;
  id?: number;
};

export function likeReview(
  reviewId: number,
): Promise<ApiResponse<ReviewLikeResult>> {
  return request(apiClient.post(`/reviews/${reviewId}/like/`));
}

export function unlikeReview(
  reviewId: number,
): Promise<ApiResponse<ReviewLikeResult>> {
  return request(apiClient.delete(`/reviews/${reviewId}/like/`));
}

export type ReviewReportReason =
  | "spam"
  | "abuse"
  | "misinformation"
  | "off_topic"
  | "private_information"
  | "other";

export type MyReviewReport = {
  id: number;
  review_id: number;
  reason: ReviewReportReason;
  explanation: string | null;
  submitted_at: string;
  state: "submitted" | "reviewed" | "withdrawn";
};

export function getMyReviewReport(
  reviewId: number,
): Promise<ApiResponse<MyReviewReport>> {
  return request(apiClient.get(`/reviews/${reviewId}/report/`));
}

export function reportReview(
  reviewId: number,
  reportType: ReviewReportReason,
  explanation?: string,
) {
  return request(
    apiClient.post(`/reviews/${reviewId}/report/`, {
      report_type: reportType,
      ...(explanation ? { explanation } : {}),
    }),
  );
}
