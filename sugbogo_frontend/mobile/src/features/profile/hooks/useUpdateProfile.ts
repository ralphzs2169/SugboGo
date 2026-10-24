import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateProfile } from "../api/profile.service";
import {
  assertProfileSessionCurrent,
  captureProfileSession,
} from "../utils/profileSession";
import type {
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "../types/profile.types";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

export function useUpdateProfile() {
  const [isUpdating, setIsUpdating] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function updateUserProfile(
    data: UpdateProfileRequest,
  ): Promise<ApiResponse<UpdateProfileResponse>> {
    const session = captureProfileSession();
    setIsUpdating(true);

    try {
      const response = await updateProfile(data);
      assertProfileSessionCurrent(session);

      if (response.success) {
        setUser(response.data);
      }

      return response;
    } finally {
      setIsUpdating(false);
    }
  }

  return {
    updateUserProfile,
    isUpdating,
  };
}
