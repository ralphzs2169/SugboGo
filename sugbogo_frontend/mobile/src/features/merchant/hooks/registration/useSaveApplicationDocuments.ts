import { useState } from "react";

import { saveApplicationDocuments } from "../../api/merchantApplication.service";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { ApplicationDocumentResponse } from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the verification documents section of the merchant application.
 *
 * Tracks the upload state while sending new verification documents
 * to the registration API and returns the API response to the wizard.
 */
export default function useSaveApplicationDocuments() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveDocuments(
    formData: FormData,
  ): Promise<ApiResponse<ApplicationDocumentResponse[]>> {
    setIsSaving(true);

    try {
      return await saveApplicationDocuments(formData);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveDocuments,
    isSaving,
  };
}
