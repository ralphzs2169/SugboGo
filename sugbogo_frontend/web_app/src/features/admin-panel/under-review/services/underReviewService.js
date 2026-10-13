import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/under-review/";

export async function fetchUnderReviewReviews(params = {}) {
  const response = await apiClient.get(BASE_URL, { params });
  return response.data.data;
}

export async function fetchUnderReviewReview(reviewId) {
  const response = await apiClient.get(`${BASE_URL}${reviewId}/`);
  return response.data.data;
}

export async function approveUnderReviewReview(reviewId) {
  const response = await apiClient.post(`${BASE_URL}${reviewId}/approve/`);
  return response.data.data;
}

export async function rejectUnderReviewReview(reviewId) {
  const response = await apiClient.post(`${BASE_URL}${reviewId}/reject/`);
  return response.data.data;
}
