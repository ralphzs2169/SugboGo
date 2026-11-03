import apiClient from "@/shared/api/apiClient";

/** Read the server-owned directory snapshot and PHT additions comparison. */
export async function fetchBusinessOverview({ signal } = {}) {
  const response = await apiClient.get("/admin/businesses/overview/", {
    signal,
  });

  return response.data.data;
}

export async function fetchBusinesses(params = {}) {
  const response = await apiClient.get("/admin/businesses/", {
    params,
  });

  return response.data.data;
}

export async function fetchBusinessLocations(params = {}, signal) {
  const response = await apiClient.get("/admin/businesses/map/", {
    params,
    signal,
  });

  return response.data.data;
}

export async function fetchBusiness(businessId, { signal } = {}) {
  const response = await apiClient.get(`/admin/businesses/${businessId}/`, {
    signal,
  });

  return response.data.data;
}

export async function queueReviewInsightsRefresh(businessId) {
  const response = await apiClient.post(
    `/admin/businesses/${businessId}/review-insights/refresh/`,
  );

  return response.data;
}

/** Read Task A's scoped recorded visits independently of relational detail availability. */
export async function fetchBusinessVisits(businessId, { signal } = {}) {
  const response = await apiClient.get("/admin/analytics/discovery-summary/", {
    params: { business_id: businessId, period: "30" },
    signal,
  });
  return response.data.data;
}

/** Load a bounded page of protected business transitions using standard pagination. */
export async function fetchBusinessStatusHistory(
  businessId,
  page,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/admin/businesses/${businessId}/status-history/`,
    {
      params: { page, page_size: 3 },
      signal,
    },
  );
  return response.data.data;
}

/** Retrieve the authoritative lifecycle snapshot only when an action needs it. */
export async function fetchBusinessStatus(businessId, { signal } = {}) {
  const response = await apiClient.get(
    `/admin/businesses/${businessId}/status/`,
    {
      signal,
    },
  );
  return response.data.data;
}

/** Suspend using the unchanged transition identity from the status response. */
export async function suspendBusiness(businessId, payload) {
  const response = await apiClient.post(
    `/admin/businesses/${businessId}/suspend/`,
    payload,
  );
  return response.data.data;
}

/** Restore business eligibility without changing the merchant account. */
export async function reactivateBusiness(businessId, payload) {
  const response = await apiClient.post(
    `/admin/businesses/${businessId}/reactivate/`,
    payload,
  );
  return response.data.data;
}
