import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateMerchantBusinessOperatingHours } from "@/features/merchant/api/merchantBusinessProfile.service";
import type { MerchantBusinessOperatingHoursUpdate } from "@/features/merchant/types/merchantBusinessProfile.types";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { merchantBusinessProfileKey } from "./merchantBusinessProfileQueryKeys";

/** Save approved hours and refresh their owner and public detail views. */
export default function useUpdateMerchantOperatingHours(
  businessId: number | undefined,
) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation({
    mutationFn: async (schedule: MerchantBusinessOperatingHoursUpdate) => {
      const response = await updateMerchantBusinessOperatingHours(schedule);
      return throwOnApiError(response);
    },
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: merchantBusinessProfileKey(userId),
          refetchType: "all",
        }),
      ];

      if (businessId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: exploreBusinessDetailKey(businessId),
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });

  return {
    updateOperatingHours: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
