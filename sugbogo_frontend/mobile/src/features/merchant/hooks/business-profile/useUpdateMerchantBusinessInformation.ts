import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateMerchantBusinessInformation } from "@/features/merchant/api/merchantBusinessProfile.service";
import type {
  MerchantBusinessInformationUpdate,
  MerchantBusinessProfileResponse,
} from "@/features/merchant/types/merchantBusinessProfile.types";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { merchantBusinessProfileKey } from "./merchantBusinessProfileQueryKeys";

/** Saves operational business information and refreshes owner/public details. */
export default function useUpdateMerchantBusinessInformation(
  businessId: number | undefined,
) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation({
    mutationFn: async (changes: MerchantBusinessInformationUpdate) => {
      const response = await updateMerchantBusinessInformation(changes);

      return throwOnApiError(response);
    },
    onSuccess: async (information) => {
      queryClient.setQueryData<MerchantBusinessProfileResponse>(
        merchantBusinessProfileKey(userId),
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            ...information,
          };
        },
      );

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
    updateInformation: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
