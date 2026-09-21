import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type {
  ApiError,
  ApiResponse,
} from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { saveApplicationDocuments } from "../../api/merchantApplication.service";
import type { ApplicationDocumentResponse } from "../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

/**
 * Saves the verification documents section of the merchant application.
 *
 * Handles document uploads, loading state, system-error handling,
 * and user-facing error feedback for Step 5.
 */
export default function useSaveApplicationDocuments() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation<
    ApiResponse<ApplicationDocumentResponse[]>,
    ApiError,
    FormData
  >({
    mutationFn: async (formData) => {
      const response = await saveApplicationDocuments(formData);

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

  async function saveDocuments(
    formData: FormData,
  ): Promise<ApiResponse<ApplicationDocumentResponse[]>> {
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
          "We couldn't save your verification documents. Please try again.",
      });

      return response;
    }
  }

  return {
    saveDocuments,
    isSaving: mutation.isPending,
    error: mutation.error,
  };
}
