import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";

import { getExploreBusinessDetail } from "@/features/explore/api/exploreBusiness.service";
import { exploreBusinessDetailStaleTime } from "@/features/explore/hooks/exploreBusinessDetailQueryPolicy";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { isBusinessDetailDenied } from "@/features/explore/utils/businessDetailAvailability";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

/** Reads the existing public rating without writing merchant visits to Recent Explore. */
export default function useMerchantBusinessRating(businessId: number) {
  const isFocused = useIsFocused();
  const query = useQuery({
    queryKey: exploreBusinessDetailKey(businessId),
    queryFn: async () =>
      throwOnApiError(await getExploreBusinessDetail(businessId)),
    enabled: businessId > 0 && isFocused,
    staleTime: (query) => exploreBusinessDetailStaleTime(query.state.data),
    retry: (failureCount, error) =>
      !isBusinessDetailDenied(error) && failureCount < 1,
  });

  return {
    rating: query.error ? null : query.data?.sentiment_rating,
    refetch: query.refetch,
  };
}
