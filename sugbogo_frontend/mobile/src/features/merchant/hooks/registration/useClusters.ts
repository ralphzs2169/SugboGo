import { useQuery } from "@tanstack/react-query";

import type { ApiError } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getClusters } from "../../api/merchantApplication.service";
import type { ClusterOption } from "../../types/registration/registrationOption.types";
import {
  MERCHANT_REGISTRATION_OPTIONS_STALE_TIME,
  merchantApplicationKeys,
} from "../merchantApplicationQueryKeys";

export default function useClusters() {
  const query = useQuery<ClusterOption[], ApiError>({
    queryKey: merchantApplicationKeys.clusters(),
    queryFn: async () => {
      const response = await getClusters();

      return throwOnApiError(response);
    },
    staleTime: MERCHANT_REGISTRATION_OPTIONS_STALE_TIME,
  });

  return {
    clusters: query.data ?? [],
    isLoading: query.isLoading,
    hasData: query.data !== undefined,
    error: query.error,
    refetch: query.refetch,
  };
}
