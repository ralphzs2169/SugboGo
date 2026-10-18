import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  PlusPeerReport,
  PlusStoredInsightsReport,
  PlusProfileTimingReport,
  PlusRecommendationsReport,
  RecommendationRefreshResult,
} from "../types/merchantAdvancedAnalytics.types";
import type {
  AnalyticsInterval,
  AnalyticsSelection,
  MerchantPlusStatus,
  PlusPocketReport,
  PlusReviewPerformanceReport,
  PlusSpecialtyReport,
  PlusVisibilityReport,
} from "../types/merchantPlusAnalytics.types";

/** Reads effective access without activating or changing demo entitlement. */
export function getMerchantPlusStatus(
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantPlusStatus>> {
  return request(apiClient.get("/merchant/plus/status/", { signal }));
}

/** Reads only the requested visibility interval, retaining source metadata. */
export function getMerchantPlusVisibility(
  selection: AnalyticsSelection,
  interval: AnalyticsInterval,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusVisibilityReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/visibility/", {
      params: { ...selection, interval },
      signal,
    }),
  );
}

/** Reads recorded weekly SAVE observations, independently of current holders. */
export function getMerchantPlusPocket(
  selection: AnalyticsSelection,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusPocketReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/pocket/", {
      params: selection,
      signal,
    }),
  );
}

/** Reads weekly additions that remain valid on current active specialties. */
export function getMerchantPlusSpecialties(
  selection: AnalyticsSelection,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusSpecialtyReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/specialties/", {
      params: selection,
      signal,
    }),
  );
}

/** Reads stored sentiment and retained-reply performance without triggering generation. */
export function getMerchantPlusReviewPerformance(
  selection: AnalyticsSelection,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusReviewPerformanceReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/review-performance/", {
      params: selection,
      signal,
    }),
  );
}

/** Reads anonymous medians with backend suppression and source metadata intact. */
export function getMerchantPlusPeers(
  selection: AnalyticsSelection,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusPeerReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/peers/", {
      params: selection,
      signal,
    }),
  );
}

/** The stored content owns its window; no dashboard period is sent. */
export function getMerchantPlusStoredInsights(
  signal?: AbortSignal,
): Promise<ApiResponse<PlusStoredInsightsReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/review-insights/", { signal }),
  );
}

/** Reads the server's Manila weekday/hour distribution without inferring arrivals. */
export function getMerchantPlusProfileTiming(
  selection: AnalyticsSelection,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusProfileTimingReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/engagement-heatmap/", {
      params: { ...selection, metric: "profile_visits" },
      signal,
    }),
  );
}

/** Reads stored state and deterministic evidence; never starts generation. */
export function getMerchantPlusRecommendations(
  selection: AnalyticsSelection,
  signal?: AbortSignal,
): Promise<ApiResponse<PlusRecommendationsReport>> {
  return request(
    apiClient.get("/merchant/analytics/premium/recommendations/", {
      params: selection,
      signal,
    }),
  );
}

/** Explicitly requests background generation using the existing JSON-body contract. */
export function refreshMerchantPlusRecommendations(
  selection: AnalyticsSelection,
): Promise<ApiResponse<RecommendationRefreshResult>> {
  return request(
    apiClient.post(
      "/merchant/analytics/premium/recommendations/refresh/",
      selection,
    ),
  );
}
