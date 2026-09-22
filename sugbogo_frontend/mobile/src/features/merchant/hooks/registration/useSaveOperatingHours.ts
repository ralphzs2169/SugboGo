import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type {
  ApiError,
  ApiResponse,
} from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { saveApplicationOperatingHours } from "../../api/merchantApplication.service";
import type {
  ApplicationOperatingHoursPayload,
  ApplicationOperatingHoursResponse,
} from "../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

/**
 * Saves the operating-hours section of the merchant application.
 *
 * Handles API communication, system-error handling, and user feedback
 * while exposing the save state to the registration flow.
 */
export default function useSaveOperatingHours() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation<
    ApiResponse<ApplicationOperatingHoursResponse[]>,
    ApiError,
    ApplicationOperatingHoursPayload
  >({
    mutationFn: async (payload) => {
      const response = await saveApplicationOperatingHours(payload);

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

  async function saveOperatingHours(
    payload: ApplicationOperatingHoursPayload,
  ): Promise<ApiResponse<ApplicationOperatingHoursResponse[]>> {
    try {
      return await mutation.mutateAsync(payload);
    } catch (error) {
      const response = error as ApiError;

      handleSystemError(response);

      Toast.show({
        type: "error",
        text1: "Unable to save",
        text2:
          response.message ||
          "We couldn't save your operating hours. Please try again.",
      });

      return response;
    }
  }

  return {
    saveOperatingHours,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
