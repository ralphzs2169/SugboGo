import { useState } from "react";
import Toast from "react-native-toast-message";

import { saveApplicationLocation } from "../../api/merchantApplication.service";

import { handleSystemError } from "@/shared/utils/apiErrors";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  ApplicationLocationPayload,
  ApplicationLocationResponse,
} from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the business location section of the merchant application.
 *
 * Handles API communication, loading state, system-error handling,
 * and user-facing error feedback for Step 2.
 */
export default function useSaveApplicationLocation() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveLocation(
    payload: ApplicationLocationPayload,
  ): Promise<ApiResponse<ApplicationLocationResponse>> {
    setIsSaving(true);

    try {
      const response = await saveApplicationLocation(payload);

      if (!response.success) {
        if (handleSystemError(response)) {
          return response;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your location. Please try again.",
        });
      }

      return response;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveLocation,
    isSaving,
  };
}
