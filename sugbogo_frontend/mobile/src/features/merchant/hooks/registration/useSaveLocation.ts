import { useState } from "react";

import { saveApplicationLocation } from "../../api/merchantApplication.service";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  ApplicationLocationPayload,
  ApplicationLocationResponse,
} from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the business location section of the merchant application.
 *
 * Tracks the save state while sending the current Step 2 data to the
 * registration API and returns the API response to the registration wizard.
 */
export default function useSaveApplicationLocation() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveLocation(
    payload: ApplicationLocationPayload,
  ): Promise<ApiResponse<ApplicationLocationResponse>> {
    setIsSaving(true);

    try {
      return await saveApplicationLocation(payload);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveLocation,
    isSaving,
  };
}
