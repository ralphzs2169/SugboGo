import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { removeProfilePicture } from "../api/profile.service";
import {
  assertProfileSessionCurrent,
  captureProfileSession,
} from "../utils/profileSession";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import { User } from "@/features/users/types/user.types";

export function useRemoveProfilePicture() {
  const [isRemoving, setIsRemoving] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function removePicture(): Promise<ApiResponse<User>> {
    const session = captureProfileSession();
    setIsRemoving(true);

    try {
      const response = await removeProfilePicture();
      assertProfileSessionCurrent(session);

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
