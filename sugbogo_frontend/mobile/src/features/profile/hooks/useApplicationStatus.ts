import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

/**
 * Fetches the authenticated merchant's application status.
 * The status indicates whether the merchant's application is pending, approved, or rejected.
 * The merchantModeAcknowledged flag indicates whether the merchant has acknowledged their mode.
 */
export default function useApplicationStatus() {
  const userId = useAuthStore((state) => state.user?.id);

  const query = useQuery({
    queryKey: ["merchant-application-status", userId],
    queryFn: async () => {
      const response = await getApplicationStatus();

      return throwOnApiError(response);
    },
    enabled: !!userId,
  });

  return {
    status: query.data?.status ?? null,
    merchantModeAcknowledged: query.data?.merchant_mode_acknowledged ?? false,
    isLoading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  };
}
