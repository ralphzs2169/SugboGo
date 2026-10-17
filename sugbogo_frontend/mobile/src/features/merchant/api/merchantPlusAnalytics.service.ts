import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
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
