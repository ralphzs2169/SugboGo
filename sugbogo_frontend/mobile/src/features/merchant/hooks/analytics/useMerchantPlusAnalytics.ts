import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  getMerchantPlusPocket,
  getMerchantPlusReviewPerformance,
  getMerchantPlusSpecialties,
  getMerchantPlusVisibility,
} from "../../api/merchantPlusAnalytics.service";
import type {
  AnalyticsInterval,
  AnalyticsSelection,
  PlusReportKind,
} from "../../types/merchantPlusAnalytics.types";
import { merchantPlusReportKey } from "./merchantPlusAnalyticsQueryKeys";
import { denyMerchantPlusAccess } from "./useMerchantPlusAccess";

/** Loads one permitted report without cross-period placeholders or cross-account data. */
function usePlusReport<T>(
  kind: PlusReportKind,
  selection: AnalyticsSelection,
  interval: AnalyticsInterval,
  enabled: boolean,
  fetchReport: (signal: AbortSignal) => Promise<ApiResponse<T>>,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  return useQuery({
    queryKey: merchantPlusReportKey(accountId, kind, selection, interval),
    queryFn: async ({ signal }) => {
      const response = await fetchReport(signal);
      if (
        !response.success &&
        response.code === "PLUS_REQUIRED" &&
        accountId &&
        useAuthStore.getState().user?.id === accountId
      ) {
        denyMerchantPlusAccess(client, accountId);
      }
      return throwOnApiError(response);
    },
    enabled: !!accountId && enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Requests one daily/weekly visibility report; metric switching reuses its response. */
export function useMerchantPlusVisibility(
  selection: AnalyticsSelection,
  interval: AnalyticsInterval,
  enabled: boolean,
) {
  return usePlusReport("visibility", selection, interval, enabled, (signal) =>
    getMerchantPlusVisibility(selection, interval, signal),
  );
}

/** Requests weekly saves only while their detail view is permitted and focused. */
export function useMerchantPlusPocket(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("pocket", selection, "weekly", enabled, (signal) =>
    getMerchantPlusPocket(selection, signal),
  );
}

/** Requests retained-valid specialty cohorts only when their detail is needed. */
export function useMerchantPlusSpecialties(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("specialties", selection, "weekly", enabled, (signal) =>
    getMerchantPlusSpecialties(selection, signal),
  );
}

/** Requests the review performance detail independently of Standard and visibility. */
export function useMerchantPlusReviews(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("reviews", selection, "weekly", enabled, (signal) =>
    getMerchantPlusReviewPerformance(selection, signal),
  );
}
