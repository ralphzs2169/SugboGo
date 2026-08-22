import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getMerchantBusinessProfile } from "@/features/merchant/api/merchantBusinessProfile.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export default function useMerchantBusinessProfile() {
  const userId = useAuthStore((state) => state.user?.id);

  const query = useQuery({
    queryKey: ["merchant-business-profile", userId],
    queryFn: async () => {
      const response = await getMerchantBusinessProfile();

      return throwOnApiError(response);
    },
    enabled: !!userId,
  });

  return {
    business: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
