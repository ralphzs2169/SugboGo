import * as DocumentPicker from "expo-document-picker";

import type { BusinessDocument } from "@/features/merchant/types/registration/registrationOption.types";

type PickBusinessDocumentsParams = {
  currentCount: number;
  maxDocuments: number;
};

/**
 * Opens the device document picker for selecting business verification documents.
 *
 * Limits the number of selected documents to the remaining available slots
 * and converts the selected assets into the application's BusinessDocument format.
 *
 * Returns an empty array when no slots remain or the user cancels the picker.
 */
export async function pickBusinessDocuments({
  currentCount,
  maxDocuments,
}: PickBusinessDocumentsParams): Promise<BusinessDocument[]> {
  const remainingSlots = maxDocuments - currentCount;

  if (remainingSlots <= 0) {
    return [];
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.slice(0, remainingSlots).map((asset) => ({
    uri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType,
  }));
}
