import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/reviews/";

/** Read the directory using only the documented server-side query parameters. */
export async function fetchAllReviews(params, { signal } = {}) {
  const response = await apiClient.get(BASE_URL, { params, signal });
  return response.data.data;
}

/** Read global inventory metrics independently of list filters and pagination. */
export async function fetchAllReviewSummary({ signal } = {}) {
  const response = await apiClient.get(`${BASE_URL}summary/`, { signal });
  return response.data.data;
}

/** Retrieve inspection data only for the selected review. */
export async function fetchAllReview(reviewId, { signal } = {}) {
  const response = await apiClient.get(`${BASE_URL}${reviewId}/`, { signal });
  return response.data.data;
}
