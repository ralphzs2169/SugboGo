import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantRoutePlanning } from "../../api/merchantRoutePlanning.service";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import { merchantRoutePlanningKey } from "./merchantAnalyticsQueryKeys";

/** Loads this Standard section independently without cross-account or cross-period placeholders. */
export default function useMerchantRoutePlanning(
  period: MerchantAnalyticsPeriod,
  enabled = true,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: merchantRoutePlanningKey(accountId, period),
    queryFn: async ({ signal }) =>
      throwOnApiError(await getMerchantRoutePlanning(period, signal)),
    enabled: !!accountId && enabled,
    staleTime: 60_000,
    retry: false,
  });
}
