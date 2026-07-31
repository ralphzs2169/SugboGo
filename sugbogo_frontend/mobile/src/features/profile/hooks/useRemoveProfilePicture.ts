import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { removeProfilePicture } from "../api/profile.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import { User } from "@/features/users/types/user.types";

export function useRemoveProfilePicture() {
  const [isRemoving, setIsRemoving] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function removePicture(): Promise<ApiResponse<User>> {
    setIsRemoving(true);

    try {
      const response = await removeProfilePicture();

      if (response.success) {
        setUser(response.data);
      }

      return response;
    } finally {
      setIsRemoving(false);
    }
  }

  return {
    removePicture,
    isRemoving,
  };
}
