import { useState } from "react";

import { saveApplicationOperatingHours } from "../../api/merchantApplication.service";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  ApplicationOperatingHoursPayload,
  ApplicationOperatingHoursResponse,
} from "../../types/merchant-application/applicationApi.types";

/**
 * Saves the operating-hours section of the merchant application.
 *
 * Tracks the save state while sending the current Step 3 data to the
 * registration API and returns the API response to the registration wizard.
 */
export default function useSaveOperatingHours() {
  const [isSaving, setIsSaving] = useState(false);

  async function saveOperatingHours(
    payload: ApplicationOperatingHoursPayload,
  ): Promise<ApiResponse<ApplicationOperatingHoursResponse[]>> {
    setIsSaving(true);

    try {
      return await saveApplicationOperatingHours(payload);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    saveOperatingHours,
    isSaving,
  };
}
