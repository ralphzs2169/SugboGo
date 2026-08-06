import { useState } from "react";
import Toast from "react-native-toast-message";

import { saveApplicationIdentity } from "../../api/merchantApplication.service";

import { handleSystemError } from "@/shared/utils/apiErrors";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  ApplicationIdentityPayload,
  ApplicationIdentityResponse,
} from "../../types/registration/registrationApi.types";

/**
 * Saves the business identity section of the merchant application.
 *
 * Handles API communication, loading state, system-error handling,
 * and user-facing error feedback for Step 1.
 */
export default function useSaveApplicationIdentity() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveIdentity(
    payload: ApplicationIdentityPayload,
  ): Promise<ApiResponse<ApplicationIdentityResponse>> {
    setIsSaving(true);

    try {
      const response = await saveApplicationIdentity(payload);

      if (!response.success) {
        if (handleSystemError(response)) {
          return response;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your business identity. Please try again.",
        });
      }

      return response;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveIdentity,
    isSaving,
  };
}
