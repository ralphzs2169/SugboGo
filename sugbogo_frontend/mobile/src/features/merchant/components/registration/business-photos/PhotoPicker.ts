import * as ImagePicker from "expo-image-picker";

import type { BusinessPhoto } from "@/features/merchant/types/merchantRegistration.types";
import { processImage } from "@/shared/utils/image/processImage.utils";

type PickBusinessPhotosParams = {
  currentCount: number;
  maxPhotos: number;
};

/**
 * Opens the device media library, limits the number of selected photos,
 * and prepares large images for efficient upload.
 */
export async function pickBusinessPhotos({
  currentCount,
  maxPhotos,
}: PickBusinessPhotosParams): Promise<BusinessPhoto[]> {
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
    quality: 0.8,
  });

  if (result.canceled) {
    return [];
  }

  return Promise.all(
    result.assets.map(async (asset) => {
      const processedImage = await processImage(
        asset.uri,
        asset.width,
        asset.height,
      );

      return {
        uri: processedImage.uri,
        fileName: asset.fileName,
        mimeType: processedImage.mimeType,
      };
    }),
  );
}
