import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/review-disputes/";

export async function fetchReviewDisputes(params = {}) {
  const response = await apiClient.get(BASE_URL, {
    params,
  });

  return response.data.data;
}

export async function fetchReviewDispute(disputeId) {
  const response = await apiClient.get(`${BASE_URL}${disputeId}/`);

  return response.data.data;
}

export async function startReviewDispute(disputeId) {
  const response = await apiClient.post(
    `${BASE_URL}${disputeId}/start-review/`,
  );

  return response.data;
}

export async function upholdReviewDispute(disputeId, data = {}) {
  const response = await apiClient.post(
    `${BASE_URL}${disputeId}/uphold/`,
    data,
  );

  return response.data;
}

export async function dismissReviewDispute(disputeId, data = {}) {
  const response = await apiClient.post(
    `${BASE_URL}${disputeId}/dismiss/`,
    data,
  );

  return response.data;
}
