import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { acknowledgeMerchantMode } from "@/features/merchant/api/merchantApplication.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

/**
 * Acknowledges the authenticated merchant's mode.
 * This is used to indicate that the merchant has seen and acknowledged
 * the merchant mode information
 */
export default function useAcknowledgeMerchantMode() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  return useMutation({
    mutationFn: async () => {
      const response = await acknowledgeMerchantMode();

      return throwOnApiError(response);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchant-application-status", userId],
      });
    },
  });
}
