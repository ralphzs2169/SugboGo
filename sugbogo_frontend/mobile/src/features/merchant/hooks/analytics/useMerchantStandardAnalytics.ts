import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMerchantStandardAnalytics } from "../../api/merchantAnalytics.service";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import { merchantStandardAnalyticsKey } from "./merchantAnalyticsQueryKeys";

/** Keeps source metadata intact and retains only same-account period placeholders. */
export default function useMerchantStandardAnalytics(
  period: MerchantAnalyticsPeriod,
) {
  const userId = useAuthStore((state) => state.user?.id);

  const query = useQuery({
    queryKey: merchantStandardAnalyticsKey(userId, period),
    queryFn: async () => {
      const response = await getMerchantStandardAnalytics(period);

      return throwOnApiError(response);
    },
    enabled: !!userId,
    staleTime: 60_000,
    placeholderData: (previousData, previousQuery) => {
      if (userId && previousQuery?.queryKey[1] === userId) {
        return previousData;
      }

      return undefined;
    },
  });

  return {
    report: query.data ?? null,
    isLoading: query.isLoading || query.isPlaceholderData,
    isChangingPeriod: query.isPlaceholderData,
    isRefetching: query.isRefetching && !query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  };
}
