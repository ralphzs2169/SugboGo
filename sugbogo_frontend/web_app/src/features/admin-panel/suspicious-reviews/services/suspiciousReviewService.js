import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/suspicious-reviews/";

export async function fetchSuspiciousReviews(params = {}) {
  const response = await apiClient.get(BASE_URL, { params });
  return response.data.data;
}

export async function fetchSuspiciousReview(reviewId) {
  const response = await apiClient.get(`${BASE_URL}${reviewId}/`);
  return response.data.data;
}
