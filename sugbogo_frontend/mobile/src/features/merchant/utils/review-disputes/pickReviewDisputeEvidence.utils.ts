import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { LocalReviewDisputeEvidence } from "../../types/review-disputes/reviewDispute.types";

function getDocumentMimeType(
  fileName: string,
  mimeType?: string | null,
): string {
  if (mimeType) {
    return mimeType;
  }

  const extension = fileName.toLowerCase().split(".").pop();

  switch (extension) {
    case "pdf":
      return "application/pdf";

    case "doc":
      return "application/msword";

    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    default:
      return "application/octet-stream";
  }
}

/**
 * Picks image evidence from the device media library.
 *
 * Returns locally accessible image files shaped for dispute evidence uploads.
 */
export async function pickReviewDisputeImages(
  remainingSlots: number,
): Promise<LocalReviewDisputeEvidence[]> {
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

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    fileName: asset.fileName ?? `evidence-image-${index + 1}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    type: "image",
    fileSize: asset.fileSize,
  }));
}

/**
 * Picks document evidence from the device file picker.
 *
 * Copies selected files into the app cache so they remain accessible during
 * multipart uploads and normalizes document MIME types when necessary.
 */
export async function pickReviewDisputeDocuments(
  remainingSlots: number,
): Promise<LocalReviewDisputeEvidence[]> {
  if (remainingSlots <= 0) {
    return [];
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.slice(0, remainingSlots).map((asset) => ({
    uri: asset.uri,
    fileName: asset.name,
    mimeType: getDocumentMimeType(asset.name, asset.mimeType),
    type: "document",
    fileSize: asset.size,
  }));
}
