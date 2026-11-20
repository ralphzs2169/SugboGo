import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  getMerchantPlusPeers,
  getMerchantPlusStoredInsights,
  getMerchantPlusProfileTiming,
} from "../../api/merchantPlusAnalytics.service";
import type { AnalyticsSelection } from "../../types/merchantPlusAnalytics.types";
import { merchantStandardAnalyticsScope } from "./merchantAnalyticsQueryKeys";
import { usePlusReport } from "./useMerchantPlusAnalytics";

/** Advanced reports share Core Plus ownership, cancellation and denial behavior. */
export function useMerchantPlusPeers(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("peers", selection, "weekly", enabled, (signal) =>
    getMerchantPlusPeers(selection, signal),
  );
}

/** One account-scoped cache independent of the dashboard's date selector. */
export function useMerchantReviewInsights(enabled: boolean) {
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: [...merchantStandardAnalyticsScope(accountId), "review-insights"],
    queryFn: async ({ signal }) => {
      const response = await getMerchantPlusStoredInsights(signal);
      if (!response.success && response.code === "PLUS_REQUIRED") {
        throw new Error("Review insights are unavailable on this server.");
      }
      return throwOnApiError(response);
    },
    enabled: !!accountId && enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Day selection is local; the report already contains all seven days and 24 hours. */
export function useMerchantPlusTiming(
  selection: AnalyticsSelection,
  enabled: boolean,
) {
  return usePlusReport("timing", selection, "daily", enabled, (signal) =>
    getMerchantPlusProfileTiming(selection, signal),
  );
}
