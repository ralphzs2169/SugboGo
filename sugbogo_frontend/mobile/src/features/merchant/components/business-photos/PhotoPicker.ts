import * as ImagePicker from "expo-image-picker";

import type { BusinessPhotoDraft } from "@/features/merchant/types/businessPhotoDraft.types";
import { processImage } from "@/shared/utils/image/processImage.utils";

type PickBusinessPhotosParams = {
  currentCount: number;
  maxPhotos: number;
  maxOriginalSize?: number;
};

/**
 * Opens the device media library, limits the number of selected photos,
 * and prepares large images for efficient upload.
 */
export async function pickBusinessPhotos({
  currentCount,
  maxPhotos,
  maxOriginalSize,
}: PickBusinessPhotosParams): Promise<BusinessPhotoDraft[]> {
  const remainingSlots = maxPhotos - currentCount;

  if (remainingSlots <= 0) {
    return [];
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: remainingSlots,
    quality: maxOriginalSize === undefined ? 0.8 : 1,
  });

  if (result.canceled) {
    return [];
  }

  return Promise.all(
    result.assets.map(async (asset) => {
      if (maxOriginalSize !== undefined) {
        const originalName = asset.fileName?.toLowerCase();
        const originalMimeType = asset.mimeType?.toLowerCase();

        if (
          (originalName && !/\.(jpe?g|png)$/.test(originalName)) ||
          (originalMimeType &&
            originalMimeType !== "image/jpeg" &&
            originalMimeType !== "image/png")
        ) {
          throw new Error("Choose a JPG, JPEG, or PNG photo.");
        }

        if (asset.fileSize == null) {
          throw new Error("Unable to verify the original photo size.");
        }

        if (asset.fileSize > maxOriginalSize) {
          throw new Error("Each original photo must be 10 MB or smaller.");
        }
      }

      const processedImage = await processImage(
        asset.uri,
        asset.width,
        asset.height,
        { mimeType: asset.mimeType },
      );

      const fileName = processedImage.converted
        ? `${asset.fileName?.replace(/\.[^.]+$/, "") ?? "business-photo"}.jpg`
        : asset.fileName;

      return {
        uri: processedImage.uri,
        fileName,
        mimeType: processedImage.mimeType,
      };
    }),
  );
}
