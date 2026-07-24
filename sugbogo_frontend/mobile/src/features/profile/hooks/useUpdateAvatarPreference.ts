import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateAvatarPreference } from "../api/profile.service";
import { ApiResponse } from "@/shared/api/types";
import {
  UpdateAvatarPreferenceResponse,
  UpdateAvatarPreferenceRequest,
} from "../api/profile.types";

export function useUpdateAvatarPreference() {
  const [isUpdating, setIsUpdating] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function updatePreference(
    data: UpdateAvatarPreferenceRequest,
  ): Promise<ApiResponse<UpdateAvatarPreferenceResponse>> {
    setIsUpdating(true);

    try {
      const response = await updateAvatarPreference(data);

      if (response.success) {
        setUser(response.data);
      }

      return response;
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    updatePreference,
    isUpdating,
  };
}
