import { useState } from "react";
import { updateProfilePicture } from "../api/profile.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getCurrentUser } from "@/features/auth/api/auth.service";

/**
 * Custom hook to handle updating the user's profile picture.
 * @returns {Object} An object containing the uploadProfilePicture function and isUploading state.
 */
export function useUpdateProfilePicture() {
  const [isUploading, setIsUploading] = useState(false);

  async function uploadProfilePicture(imageUri: string) {
    setIsUploading(true);

    try {
      const formData = new FormData();

      formData.append("image", {
        uri: imageUri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);

      const response = await updateProfilePicture(formData);

      if (!response.success) {
        throw new Error(response.message);
      }

      // Update the user in the auth store with the new avatar URL
      const user = await getCurrentUser();
      console.log("3. User refreshed");
      useAuthStore.getState().setUser(user);
      console.log("4. Store updated");

      return response.data.avatar_url;
    } finally {
      setIsUploading(false);
    }
  }

  return {
    uploadProfilePicture,
    isUploading,
  };
}
