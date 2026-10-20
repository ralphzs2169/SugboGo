import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getExploreBusinessDetail } from "@/features/explore/api/exploreBusiness.service";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

/** Loads Explorer's evidence-backed choices for the focused merchant review controls. */
export default function useMerchantReviewFilterOptions(
  businessId: number,
  enabled: boolean,
) {
  const accountId = useAuthStore((state) => state.user?.id);
  const focused = useIsFocused();

  return useQuery({
    queryKey: [
      ...exploreBusinessDetailKey(businessId),
      "merchant-review-filter-options",
      accountId,
    ],
    queryFn: async () => {
      const business = throwOnApiError(
        await getExploreBusinessDetail(businessId),
      );
      return business.review_insights ?? null;
    },
    enabled: !!accountId && !!businessId && enabled && focused,
    staleTime: 60_000,
    retry: false,
  });
}
