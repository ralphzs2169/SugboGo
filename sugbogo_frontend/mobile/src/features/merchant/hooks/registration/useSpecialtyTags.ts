import { useQuery } from "@tanstack/react-query";

import type { ApiError } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getSpecialtyTags } from "../../api/merchantApplication.service";
import type { SpecialtyTagOption } from "../../types/registration/registrationOption.types";
import {
  MERCHANT_REGISTRATION_OPTIONS_STALE_TIME,
  merchantApplicationKeys,
} from "../merchantApplicationQueryKeys";

export default function useSpecialtyTags() {
  const query = useQuery<SpecialtyTagOption[], ApiError>({
    queryKey: merchantApplicationKeys.specialtyTags(),
    queryFn: async () => {
      const response = await getSpecialtyTags();

      return throwOnApiError(response);
    },
    staleTime: MERCHANT_REGISTRATION_OPTIONS_STALE_TIME,
  });

  return {
    specialtyTags: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
