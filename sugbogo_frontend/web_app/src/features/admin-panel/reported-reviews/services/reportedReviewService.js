import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/review-reports/";

export async function fetchReportedReviews(params = {}) {
  const response = await apiClient.get(`${BASE_URL}reviews/`, { params });
  return response.data.data;
}

export async function fetchReportedReview(reviewId) {
  const response = await apiClient.get(`${BASE_URL}reviews/${reviewId}/`);
  return response.data.data;
}

export async function decideReportedReview(reviewId, decision, adminNotes) {
  const response = await apiClient.post(`${BASE_URL}reviews/${reviewId}/decision/`, {
    decision,
    admin_notes: adminNotes,
  });
  return response.data.data;
}
