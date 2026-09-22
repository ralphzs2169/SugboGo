import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { acknowledgeMerchantMode } from "@/features/merchant/api/merchantApplication.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { merchantApplicationKeys } from "./merchantApplicationQueryKeys";

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

    onSuccess: (status) => {
      queryClient.setQueryData(merchantApplicationKeys.status(userId), status);

      const currentUser = useAuthStore.getState().user;

      if (
        currentUser !== null &&
        currentUser.id === userId &&
        currentUser.role !== "merchant" &&
        status.status === "approved" &&
        status.merchant_mode_acknowledged
      ) {
        useAuthStore.getState().setUser({
          ...currentUser,
          role: "merchant",
        });
      }

      void queryClient.invalidateQueries({
        queryKey: merchantApplicationKeys.status(userId),
      });
    },
  });
}
