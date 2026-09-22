import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type {
  ApiError,
  ApiResponse,
} from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { saveApplicationPhotos } from "../../api/merchantApplication.service";
import type { ApplicationPhotoResponse } from "../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

/**
 * Saves the business photos section of the merchant application.
 *
 * Handles photo uploads, loading state, system-error handling,
 * and user-facing error feedback for Step 4.
 */
export default function useSaveApplicationPhotos() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation<
    ApiResponse<ApplicationPhotoResponse[]>,
    ApiError,
    FormData
  >({
    mutationFn: async (formData) => {
      const response = await saveApplicationPhotos(formData);

      throwOnApiError(response);

      return response;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantApplicationKeys.current(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: merchantApplicationKeys.status(userId),
        }),
      ]);
    },
  });

  async function savePhotos(
    formData: FormData,
  ): Promise<ApiResponse<ApplicationPhotoResponse[]>> {
    try {
      return await mutation.mutateAsync(formData);
    } catch (error) {
      const response = error as ApiError;

      if (handleSystemError(response)) {
        return response;
      }

      Toast.show({
        type: "error",
        text1: "Unable to save",
        text2:
          response.message ||
          "We couldn't save your business photos. Please try again.",
      });

      return response;
    }
  }

  return {
    savePhotos,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
