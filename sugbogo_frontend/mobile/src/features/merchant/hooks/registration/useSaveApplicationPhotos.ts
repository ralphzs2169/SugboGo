import { useState } from "react";
import Toast from "react-native-toast-message";

import { saveApplicationPhotos } from "../../api/merchantApplication.service";

import { handleSystemError } from "@/shared/utils/apiErrors";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { ApplicationPhotoResponse } from "../../types/registration/registrationApi.types";

/**
 * Saves the business photos section of the merchant application.
 *
 * Handles photo uploads, loading state, system-error handling,
 * and user-facing error feedback for Step 4.
 */
export default function useSaveApplicationPhotos() {
  const [isSaving, setIsSaving] = useState(false);

  async function savePhotos(
    formData: FormData,
  ): Promise<ApiResponse<ApplicationPhotoResponse[]>> {
    setIsSaving(true);

    try {
      const response = await saveApplicationPhotos(formData);

      if (!response.success) {
        if (handleSystemError(response)) {
          return response;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your business photos. Please try again.",
        });
      }

      return response;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    savePhotos,
    isSaving,
  };
}
