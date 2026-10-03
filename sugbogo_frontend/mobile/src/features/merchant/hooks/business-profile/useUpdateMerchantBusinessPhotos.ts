import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { updateMerchantBusinessPhotos } from "../../api/merchantBusinessProfile.service";
import { merchantBusinessProfileKey } from "./merchantBusinessProfileQueryKeys";

/** Save the live photo collection and refresh owner and Explorer detail reads. */
export default function useUpdateMerchantBusinessPhotos(
  businessId: number | undefined,
) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await updateMerchantBusinessPhotos(formData);
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
    savePhotos: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
