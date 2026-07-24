import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateProfilePicture } from "../api/profile.service";
import type { ApiResponse } from "@/shared/api/types";
import type { UpdateProfilePictureResponse } from "../api/profile.types";

export function useUpdateProfilePicture() {
  const [isUploading, setIsUploading] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function uploadProfilePicture(
    imageUri: string,
  ): Promise<ApiResponse<UpdateProfilePictureResponse>> {
    setIsUploading(true);

    console.log("Uploading:", imageUri);

    try {
      const formData = new FormData();

      formData.append("image", {
        uri: imageUri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);

      const response = await updateProfilePicture(formData);
      console.log("Response:", response);

      if (response.success) {
        setUser(response.data);
        console.log("NEW USER", response.data.avatar_url);
        console.log("STORE", useAuthStore.getState().user?.avatar_url);
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
