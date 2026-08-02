import * as ImagePicker from "expo-image-picker";

import type { BusinessPhoto } from "@/features/merchant/types/merchantRegistration.types";

type PickBusinessPhotosParams = {
  currentCount: number;
  maxPhotos: number;
};

/**
 * Opens the device media library for selecting business photos.
 *
 * Requests media library permission, limits selection to the remaining
 * available slots, and converts selected assets into the application's
 * BusinessPhoto format.
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

  return result.assets.map((asset) => ({
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  }));
}
