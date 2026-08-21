import { useMutation, useQueryClient } from "@tanstack/react-query";

import { acknowledgeMerchantMode } from "@/features/merchant/api/merchantApplication.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export default function useAcknowledgeMerchantMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await acknowledgeMerchantMode();

      return throwOnApiError(response);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchant-application-status"],
      });
    },
  });
}
