import { useState } from "react";

import { saveApplicationIdentity } from "../../api/merchantApplication.service";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  ApplicationIdentityPayload,
  ApplicationIdentityResponse,
} from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the business identity section of the merchant application.
 *
 * Tracks the save state while sending the current Step 1 data to the
 * registration API and returns the API response to the registration wizard.
 */
export default function useSaveApplicationIdentity() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveIdentity(
    payload: ApplicationIdentityPayload,
  ): Promise<ApiResponse<ApplicationIdentityResponse>> {
    setIsSaving(true);

    try {
      return await saveApplicationIdentity(payload);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveIdentity,
    isSaving,
  };
}
