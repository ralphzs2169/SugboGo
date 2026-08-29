import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  BusinessReview,
  BusinessReviewPreview,
  LocalReviewPhoto,
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
  text: string,
  photos: LocalReviewPhoto[],
  keepPhotoIds?: number[],
) {
  const form = new FormData();

  form.append("text", text);

  keepPhotoIds?.forEach((id) => {
    form.append("keep_photo_ids", String(id));
  });

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
): Promise<ApiResponse<BusinessReview[]>> {
  return request(apiClient.get(`/reviews/business/${businessId}/all/`));
}

export function createReview(
  businessId: number,
  text: string,
  photos: LocalReviewPhoto[],
) {
  return request(
    apiClient.post(
      `/reviews/business/${businessId}/`,
      reviewForm(text, photos),
    ),
  );
}

export function updateReview(
  reviewId: number,
  text: string,
  photos: LocalReviewPhoto[],
  keepPhotoIds: number[],
) {
  return request(
    apiClient.patch(
      `/reviews/${reviewId}/`,
      reviewForm(text, photos, keepPhotoIds),
    ),
  );
}

export function deleteReview(reviewId: number) {
  return request(apiClient.delete(`/reviews/${reviewId}/`));
}

export function deleteReviewPhoto(photoId: number) {
  return request(apiClient.delete(`/reviews/photos/${photoId}/`));
}

export function likeReview(reviewId: number): Promise<ApiResponse<null>> {
  return request(apiClient.post(`/reviews/${reviewId}/like/`));
}

export function unlikeReview(reviewId: number): Promise<ApiResponse<null>> {
  return request(apiClient.delete(`/reviews/${reviewId}/like/`));
}

export function reportReview(
  reviewId: number,
  reportType: "spam" | "abuse" | "misinformation" | "other",
) {
  return request(
    apiClient.post(`/reviews/${reviewId}/report/`, {
      report_type: reportType,
    }),
  );
}
