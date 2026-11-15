import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantDiscoverySources } from "../../api/merchantDiscoverySources.service";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import useMerchantPlusAccess from "./useMerchantPlusAccess";
import { merchantDiscoverySourcesKey } from "./merchantAnalyticsQueryKeys";

/** Lazily loads one Plus detail; never carries another account or period's data. */
export default function useMerchantDiscoverySources(
  period: MerchantAnalyticsPeriod,
  enabled = true,
) {
  const access = useMerchantPlusAccess();
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: merchantDiscoverySourcesKey(accountId, period),
    queryFn: async ({ signal }) => {
      if (!access.allowed) {
        throw { code: "PLUS_REQUIRED", message: "Merchant Plus is required." };
      }
      return throwOnApiError(await getMerchantDiscoverySources(period, signal));
    },
    enabled: !!accountId && enabled && access.allowed,
    staleTime: 60_000,
    retry: false,
  });
}
