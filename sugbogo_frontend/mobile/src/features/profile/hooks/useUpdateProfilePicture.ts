import { useState } from "react";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateProfilePicture } from "../api/profile.service";

import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { UpdateProfilePictureResponse } from "../types/profile.types";

const PROFILE_IMAGE_WIDTH = 1024;
const PROFILE_IMAGE_COMPRESSION = 0.7;

/**
 * Uploads a new profile picture for the authenticated user.
 *
 * The image is optimized before upload by resizing it to the configured
 * maximum width while preserving its aspect ratio, then compressing it as
 * a JPEG to reduce file size. After a successful upload, the authenticated
 * user's state is synchronized with the updated profile returned by the API.
 *
 * @param imageUri The local URI of the image selected by the user.
 * @returns The API response containing the updated user profile.
 */
export function useUpdateProfilePicture() {
  const [isUploading, setIsUploading] = useState(false);

  const setUser = useAuthStore((state) => state.setUser);

  async function uploadProfilePicture(
    imageUri: string,
  ): Promise<ApiResponse<UpdateProfilePictureResponse>> {
    setIsUploading(true);

    try {
      // Resize the image while preserving its aspect ratio.
      // Providing only the width allows Expo to calculate the height automatically.
      const context = ImageManipulator.manipulate(imageUri);

      // 1024px provides good visual quality for profile pictures
      // while significantly reducing upload size compared to the original image.
      context.resize({
        width: PROFILE_IMAGE_WIDTH,
      });

      const result = await context.renderAsync();

      // Compress and convert the processed image to JPEG before uploading.
      const processedImage = await result.saveAsync({
        compress: PROFILE_IMAGE_COMPRESSION,
        format: SaveFormat.JPEG,
      });

      const formData = new FormData();

      formData.append("image", {
        uri: processedImage.uri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);

      const response = await updateProfilePicture(formData);

      if (response.success) {
        setUser(response.data);
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
