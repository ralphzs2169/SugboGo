import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { updateMerchantBusinessCoverPhoto } from "@/features/merchant/api/merchantBusinessProfile.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

const COVER_IMAGE_WIDTH = 1600;
const COVER_IMAGE_COMPRESSION = 0.8;

/**
 * Uploads and replaces the authenticated merchant's business cover photo.
 *
 * The selected image is resized and compressed before upload. Image
 * processing failures are separated from API failures so the UI can
 * provide an appropriate user-facing message for each case.
 */
export default function useUpdateBusinessCoverPhoto() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const mutation = useMutation({
    mutationFn: async (imageUri: string) => {
      let processedImage;

      try {
        const context = ImageManipulator.manipulate(imageUri);

        context.resize({
          width: COVER_IMAGE_WIDTH,
        });

        const result = await context.renderAsync();

        processedImage = await result.saveAsync({
          compress: COVER_IMAGE_COMPRESSION,
          format: SaveFormat.JPEG,
        });
      } catch (error) {
        console.error("Cover photo processing failed:", error);

        throw new Error(
          "Unable to process this image. Please choose another photo and try again.",
        );
      }

      const formData = new FormData();

      formData.append("cover_photo", {
        uri: processedImage.uri,
        name: "business-cover.jpg",
        type: "image/jpeg",
      } as any);

      const response = await updateMerchantBusinessCoverPhoto(formData);

      return throwOnApiError(response);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["merchant-business-profile", userId],
      });
    },
  });

  return {
    updateCoverPhoto: mutation.mutateAsync,
    isUploading: mutation.isPending,
    error: mutation.error,
  };
}
