import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantUnansweredReviews } from "../../api/merchantAnalytics.service";
import { merchantUnansweredReviewsKey } from "./merchantAnalyticsQueryKeys";

/** Keeps the independently refreshable current backlog isolated by merchant account. */
export default function useMerchantUnansweredReviews(enabled = true) {
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: merchantUnansweredReviewsKey(accountId),
    queryFn: async ({ signal }) =>
      throwOnApiError(await getMerchantUnansweredReviews(signal)),
    enabled: !!accountId && enabled,
    staleTime: 60_000,
    retry: false,
  });
}
