import * as service from "../../services/analyticsService";
import { analyticsQueryKeys } from "./analyticsQueryKeys";

export const ANALYTICS_STALE_TIME = 60_000;

function reportOptions(report, fetchReport, params) {
  const queryKey = analyticsQueryKeys[report](params);
  return {
    queryKey,
    queryFn: ({ signal }) => fetchReport(queryKey[3], { signal }),
    staleTime: ANALYTICS_STALE_TIME,
    // No previous-selection placeholders. Retry/focus/reconnect follow the shared client.
  };
}

export const analyticsQueryOptions = {
  platformOverview: (params) => reportOptions("platformOverview", service.fetchPlatformAnalytics, params),
  platformGrowth: (params) => reportOptions("platformGrowth", service.fetchPlatformGrowthAnalytics, params),
  businessAcquisition: (params) => reportOptions("businessAcquisition", service.fetchBusinessAcquisition, params),
  transportationPlanning: (params) => reportOptions("transportationPlanning", service.fetchTransportationPlanning, params),
  discoverySources: (params) => reportOptions("discoverySources", service.fetchDiscoverySources, params),
  discoverySummary: (params) => reportOptions("discoverySummary", service.fetchDiscoveryActivitySummary, params),
  discoveryTrend: (params) => reportOptions("discoveryTrend", service.fetchDiscoveryTrend, params),
  onboarding: (params) => reportOptions("onboarding", service.fetchOnboardingAnalytics, params),
  attentionQueue: (params) => reportOptions("attentionQueue", service.fetchAttentionQueueAnalytics, params),
  coverage: (params) => reportOptions("coverage", service.fetchCoverageAnalytics, params),
  businessAttention: (params) => reportOptions("businessAttention", service.fetchBusinessAttention, params),
  lowExposure: (params) => reportOptions("lowExposure", service.fetchLowExposureBusinesses, params),
  communityHealth: (params) => reportOptions("communityHealth", service.fetchCommunityHealthAnalytics, params),
  specialtySupport: (params) => reportOptions("specialtySupport", service.fetchSpecialtySupportAnalytics, params),
  changeRequests: (params) => reportOptions("changeRequests", service.fetchChangeRequestAnalytics, params),
  discoveryHeatmap: (params) => reportOptions("discoveryHeatmap", service.fetchDiscoveryHeatmap, params),
  discoveryScores: (params) => reportOptions("discoveryScores", service.fetchDiscoveryScoreAnalytics, params),
};
