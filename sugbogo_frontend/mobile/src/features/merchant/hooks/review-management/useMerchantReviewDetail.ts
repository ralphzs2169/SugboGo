import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantReviewDetail } from "../../api/merchantReviewFocus.service";
import { merchantReviewDetailKey } from "./merchantReviewQueryKeys";

/** Loads only the selected published, merchant-owned review for dispute creation. */
export default function useMerchantReviewDetail(
  businessId: number,
  reviewId: number,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: merchantReviewDetailKey(accountId, businessId, reviewId),
    queryFn: async () =>
      throwOnApiError(await getMerchantReviewDetail(businessId, reviewId)),
    enabled: !!accountId && businessId > 0 && reviewId > 0,
  });
  return { ...query, review: query.data };
}
