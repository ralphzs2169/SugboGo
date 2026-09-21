import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getCurrentApplication } from "../../api/merchantApplication.service";
import type { ApplicationDetailResponse } from "../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

export default function useCurrentApplication() {
  const userId = useAuthStore((state) => state.user?.id);

  const query = useQuery<ApplicationDetailResponse | null, ApiError>({
    queryKey: merchantApplicationKeys.current(userId),
    queryFn: async () => {
      const response = await getCurrentApplication();

      if (!response.success) {
        if (response.code === "APPLICATION_NOT_FOUND") {
          return null;
        }
      }

      return throwOnApiError(response);
    },
    enabled: !!userId,
  });

  return {
    application: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
    refresh: query.refetch,
  };
}
