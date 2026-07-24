import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateProfile } from "../api/profile.service";
import type {
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "../api/profile.types";
import type { ApiResponse } from "@/shared/api/types";

export function useUpdateProfile() {
  const [isUpdating, setIsUpdating] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function updateUserProfile(
    data: UpdateProfileRequest,
  ): Promise<ApiResponse<UpdateProfileResponse>> {
    setIsUpdating(true);

    try {
      const response = await updateProfile(data);

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
