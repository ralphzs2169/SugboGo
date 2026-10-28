import apiClient from "@/shared/api/apiClient";
import { analyticsReports, normalizeAnalyticsParams } from "../analytics/utils/reportParameters";

// Retained raw Axios contract for compatibility. New report consumers use fetch* below.
export const getAnalyticsData = async () => apiClient.get("/admin/analytics/");

async function fetchReport(report, params, { signal } = {}) {
  const response = await apiClient.get(`/admin/analytics/${analyticsReports[report].path}`, {
    params: normalizeAnalyticsParams(report, params),
    signal,
  });
  // Unwrap only the envelope. Nulls, source limitations and pagination remain intact.
  return response.data.data;
}

export const fetchPlatformAnalytics = (params, options) => fetchReport("platformOverview", params, options);
export const fetchPlatformGrowthAnalytics = (params, options) => fetchReport("platformGrowth", params, options);
export const fetchDiscoveryActivitySummary = (params, options) => fetchReport("discoverySummary", params, options);
export const fetchDiscoveryTrend = (params, options) => fetchReport("discoveryTrend", params, options);
export const fetchOnboardingAnalytics = (params, options) => fetchReport("onboarding", params, options);
export const fetchAttentionQueueAnalytics = (params, options) => fetchReport("attentionQueue", params, options);
export const fetchCoverageAnalytics = (params, options) => fetchReport("coverage", params, options);
export const fetchBusinessAttention = (params, options) => fetchReport("businessAttention", params, options);
export const fetchLowExposureBusinesses = (params, options) => fetchReport("lowExposure", params, options);
export const fetchCommunityHealthAnalytics = (params, options) => fetchReport("communityHealth", params, options);
export const fetchSpecialtySupportAnalytics = (params, options) => fetchReport("specialtySupport", params, options);
export const fetchChangeRequestAnalytics = (params, options) => fetchReport("changeRequests", params, options);
export const fetchDiscoveryHeatmap = (params, options) => fetchReport("discoveryHeatmap", params, options);
export const fetchDiscoveryScoreAnalytics = (params, options) => fetchReport("discoveryScores", params, options);
