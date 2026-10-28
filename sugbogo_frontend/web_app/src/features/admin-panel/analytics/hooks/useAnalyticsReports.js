import { useQuery } from "@tanstack/react-query";
import { analyticsQueryOptions } from "../queries/analyticsQueryOptions";

function useReportQuery(report, params, { enabled = true } = {}) {
  return useQuery({ ...analyticsQueryOptions[report](params), enabled });
}

// Each hook owns one query, exposing native data/error/refetch and loading states.
// No cross-report fetching, invalidation, toast, fallback counts or availability conversion.
export function usePlatformAnalytics(params, options) {
  return useReportQuery("platformOverview", params, options);
}

export function usePlatformGrowthAnalytics(params, options) {
  return useReportQuery("platformGrowth", params, options);
}

export function useDiscoveryTrend(params, options) {
  return useReportQuery("discoveryTrend", params, options);
}

export function useOnboardingAnalytics(params, options) {
  return useReportQuery("onboarding", params, options);
}

export function useAttentionQueueAnalytics(params, options) {
  return useReportQuery("attentionQueue", params, options);
}

export function useCoverageAnalytics(params, options) {
  return useReportQuery("coverage", params, options);
}

export function useBusinessAttention(params, options) {
  return useReportQuery("businessAttention", params, options);
}

export function useLowExposureBusinesses(params, options) {
  return useReportQuery("lowExposure", params, options);
}

export function useCommunityHealthAnalytics(params, options) {
  return useReportQuery("communityHealth", params, options);
}

export function useSpecialtySupportAnalytics(params, options) {
  return useReportQuery("specialtySupport", params, options);
}

export function useChangeRequestAnalytics(params, options) {
  return useReportQuery("changeRequests", params, options);
}

export function useDiscoveryHeatmap(params, options) {
  return useReportQuery("discoveryHeatmap", params, options);
}

export function useDiscoveryScoreAnalytics(params, options) {
  return useReportQuery("discoveryScores", params, options);
}
