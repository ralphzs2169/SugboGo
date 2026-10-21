import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantDiscoverySources } from "../../api/merchantDiscoverySources.service";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import { merchantDiscoverySourcesKey } from "./merchantAnalyticsQueryKeys";

/** Lazily loads one Standard detail; never carries another account or period's data. */
export default function useMerchantDiscoverySources(
  period: MerchantAnalyticsPeriod,
  enabled = true,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: merchantDiscoverySourcesKey(accountId, period),
    queryFn: async ({ signal }) =>
      throwOnApiError(await getMerchantDiscoverySources(period, signal)),
    enabled: !!accountId && enabled,
    staleTime: 60_000,
    retry: false,
  });
}
