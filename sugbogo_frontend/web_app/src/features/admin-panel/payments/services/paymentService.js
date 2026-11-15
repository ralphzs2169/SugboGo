import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/payments/";

/** Read the directory using only the documented server-side query parameters. */
export async function fetchPayments(params, { signal } = {}) {
  const response = await apiClient.get(BASE_URL, { params, signal });
  return response.data.data;
}

/** Read global inventory metrics independently of list filters and pagination. */
export async function fetchPaymentSummary({ signal } = {}) {
  const response = await apiClient.get(`${BASE_URL}summary/`, { signal });
  return response.data.data;
}

/** Retrieve inspection data only for the selected payment. */
export async function fetchPayment(paymentId, { signal } = {}) {
  const response = await apiClient.get(`${BASE_URL}${paymentId}/`, { signal });
  return response.data.data;
}
