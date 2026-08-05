import { useState } from "react";

import { saveApplicationPhotos } from "../../api/merchantApplication.service";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { ApplicationPhotoResponse } from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the business photos section of the merchant application.
 *
 * Tracks the upload state while sending the selected business photos
 * to the registration API and returns the API response to the wizard.
 */
export default function useSaveApplicationPhotos() {
  const [isSaving, setIsSaving] = useState(false);

  async function savePhotos(
    formData: FormData,
  ): Promise<ApiResponse<ApplicationPhotoResponse[]>> {
    setIsSaving(true);

    try {
      return await saveApplicationPhotos(formData);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    savePhotos,
    isSaving,
  };
}
