import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type {
  ApiError,
  ApiResponse,
} from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { saveApplicationIdentity } from "../../api/merchantApplication.service";
import type {
  ApplicationIdentityPayload,
  ApplicationIdentityResponse,
} from "../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

/**
 * Saves the business identity section of the merchant application.
 *
 * Handles API communication, loading state, system-error handling,
 * and user-facing error feedback for Step 1.
 */
export default function useSaveApplicationIdentity() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation<
    ApiResponse<ApplicationIdentityResponse>,
    ApiError,
    ApplicationIdentityPayload
  >({
    mutationFn: async (payload) => {
      const response = await saveApplicationIdentity(payload);

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

  async function saveIdentity(
    payload: ApplicationIdentityPayload,
  ): Promise<ApiResponse<ApplicationIdentityResponse>> {
    try {
      return await mutation.mutateAsync(payload);
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
          "We couldn't save your business identity. Please try again.",
      });

      return response;
    }
  }

  return {
    saveIdentity,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
