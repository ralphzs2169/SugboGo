import { useQuery } from "@tanstack/react-query";

import type { ApiError } from "@/shared/types/apiResponse.types";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getCategories } from "../../api/merchantApplication.service";
import type { CategoryOption } from "../../types/registration/registrationOption.types";
import {
  MERCHANT_REGISTRATION_OPTIONS_STALE_TIME,
  merchantApplicationKeys,
} from "../merchantApplicationQueryKeys";

export default function useCategories() {
  const query = useQuery<CategoryOption[], ApiError>({
    queryKey: merchantApplicationKeys.categories(),
    queryFn: async () => {
      const response = await getCategories();

      return throwOnApiError(response);
    },
    staleTime: MERCHANT_REGISTRATION_OPTIONS_STALE_TIME,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    hasData: query.data !== undefined,
    error: query.error,
    refetch: query.refetch,
  };
}
