import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMerchantReviewLocation } from "../../api/merchantReviewFocus.service";
import { merchantReviewFocusKey } from "./merchantReviewQueryKeys";

/** Resolves each notification entry to a server-ordered page before loading the feed. */
export default function useMerchantReviewFocus(
  businessId: number,
  reviewId: number | null,
  entry: number,
  enabled: boolean,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: merchantReviewFocusKey(accountId, businessId, reviewId, entry),
    queryFn: async () =>
      throwOnApiError(await getMerchantReviewLocation(businessId, reviewId!)),
    enabled: !!accountId && !!businessId && !!reviewId && enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}
