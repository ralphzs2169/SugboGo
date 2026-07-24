import { useState } from "react";
import { updateProfilePicture } from "../api/profile.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getCurrentUser } from "@/features/auth/api/auth.service";
import type { ApiResponse } from "@/shared/api/types";
import type { UpdateProfilePictureResponse } from "../api/profile.types";

export function useUpdateProfilePicture() {
  const [isUploading, setIsUploading] = useState(false);

  async function uploadProfilePicture(
    imageUri: string,
  ): Promise<ApiResponse<UpdateProfilePictureResponse>> {
    setIsUploading(true);

    try {
      const formData = new FormData();

      formData.append("image", {
        uri: imageUri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);

      const response = await updateProfilePicture(formData);

      if (response.success) {
        const user = await getCurrentUser();

        useAuthStore.getState().setUser(user);
      }

      return response;
    } finally {
      setIsUploading(false);
    }
  }

  return {
    uploadProfilePicture,
    isUploading,
  };
}
