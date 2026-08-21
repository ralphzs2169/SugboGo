import { useQuery } from "@tanstack/react-query";

import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export default function useApplicationStatus() {
  const query = useQuery({
    queryKey: ["merchant-application-status"],
    queryFn: async () => {
      const response = await getApplicationStatus();

      return throwOnApiError(response);
    },
  });

  return {
    status: query.data?.status ?? null,
    merchantModeAcknowledged: query.data?.merchant_mode_acknowledged ?? false,
    isLoading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  };
}
