import { useState } from "react";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import { updateProfilePicture } from "../api/profile.service";

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

      console.log("PROFILE UPLOAD RESPONSE:", response);

      if (!response.success) {
        throw new Error(response.message);
      }

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
