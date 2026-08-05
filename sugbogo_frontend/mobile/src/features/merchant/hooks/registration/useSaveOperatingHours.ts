import { useState } from "react";
import Toast from "react-native-toast-message";

import { saveApplicationOperatingHours } from "../../api/merchantApplication.service";

import { handleSystemError } from "@/shared/utils/apiErrors";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  ApplicationOperatingHoursPayload,
  ApplicationOperatingHoursResponse,
} from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the operating-hours section of the merchant application.
 *
 * Handles API communication, system-error handling, and user feedback
 * while exposing the save state to the registration flow.
 */
export default function useSaveOperatingHours() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveOperatingHours(
    payload: ApplicationOperatingHoursPayload,
  ): Promise<ApiResponse<ApplicationOperatingHoursResponse[]>> {
    setIsSaving(true);

    try {
      const response = await saveApplicationOperatingHours(payload);

      if (!response.success) {
        handleSystemError(response);

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2: "We couldn't save your operating hours. Please try again.",
        });
      }

      return response;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveOperatingHours,
    isSaving,
  };
}
