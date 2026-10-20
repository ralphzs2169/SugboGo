import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMerchantRecentActivity } from "../../api/merchantRecentActivity.service";
import { merchantRecentActivityKey } from "./merchantDashboardQueryKeys";

/** Refreshes the account's timeline on each tab entry while preserving cached rows on errors. */
export default function useMerchantRecentActivity(enabled = true) {
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: merchantRecentActivityKey(accountId),
    queryFn: async ({ signal }) =>
      throwOnApiError(await getMerchantRecentActivity(signal)),
    enabled: !!accountId && enabled,
    staleTime: 0,
    retry: false,
  });
}
