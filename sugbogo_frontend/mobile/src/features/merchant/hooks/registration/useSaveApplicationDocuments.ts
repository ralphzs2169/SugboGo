import { useState } from "react";
import Toast from "react-native-toast-message";

import { saveApplicationDocuments } from "../../api/merchantApplication.service";

import { handleSystemError } from "@/shared/utils/apiErrors";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { ApplicationDocumentResponse } from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the verification documents section of the merchant application.
 *
 * Handles document uploads, loading state, system-error handling,
 * and user-facing error feedback for Step 5.
 */
export default function useSaveApplicationDocuments() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveDocuments(
    formData: FormData,
  ): Promise<ApiResponse<ApplicationDocumentResponse[]>> {
    setIsSaving(true);

    try {
      const response = await saveApplicationDocuments(formData);

      if (!response.success) {
        if (handleSystemError(response)) {
          return response;
        }

        Toast.show({
          type: "error",
          text1: "Unable to save",
          text2:
            "We couldn't save your verification documents. Please try again.",
        });
      }

      return response;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveDocuments,
    isSaving,
  };
}
