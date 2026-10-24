import apiClient from "@/shared/api/apiClient";

export async function fetchDiscoveryScores(params = {}) {
  const response = await apiClient.get("/admin/analytics/discovery-scores/", {
    params,
  });
  return response.data.data;
}

export async function recomputeDiscoveryScores() {
  const response = await apiClient.post(
    "/admin/analytics/discovery-scores/recompute/",
  );
  return response.data.data;
}

/** Load one current diagnostic only through the explicitly enabled query. */
export async function fetchVisibilityDiagnostics(businessId, signal) {
  const response = await apiClient.get(
    `/admin/analytics/discovery-scores/${businessId}/visibility-diagnostics/`,
    { signal },
  );
  return response.data.data;
}

/** Keep diagnostics opt-in, with no focus, reconnect, or automatic failure retries. */
export function visibilityDiagnosticOptions(businessId) {
  return {
    queryKey: ["admin", "visibility-diagnostics", businessId],
    queryFn: ({ signal }) => fetchVisibilityDiagnostics(businessId, signal),
    enabled: Boolean(businessId),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}
