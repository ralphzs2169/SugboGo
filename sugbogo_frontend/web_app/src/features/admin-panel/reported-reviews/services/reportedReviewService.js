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

export async function decideReviewReport(reportId, decision, adminNotes) {
  const action = decision === "confirm" ? "approve" : "reject";
  const response = await apiClient.post(`${BASE_URL}${reportId}/${action}/`, {
    admin_notes: adminNotes,
  });
  return response.data.data;
}
