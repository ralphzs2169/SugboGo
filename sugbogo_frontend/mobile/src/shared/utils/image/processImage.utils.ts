import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImageRef } from "expo-image-manipulator";

const TARGET_PHOTO_BYTES = 500_000;
const SMALLER_JPEG_QUALITY = 0.6;

type ProcessImageOptions = {
  maxDimension?: number;
  compress?: number;
  mimeType?: string | null;
};

/** Reads the size of a local photo without loading its contents into JavaScript. */
function getPhotoSize(uri: string) {
  if (!uri.startsWith("file://") && !uri.startsWith("content://")) {
    return undefined;
  }

  try {
    const size = new File(uri).size;
    return size > 0 ? size : undefined;
  } catch {
    return undefined;
  }
}

/** Removes a discarded JPEG from Expo's image cache when possible. */
function deleteCachedPhoto(uri: string) {
  if (!uri.startsWith("file://")) {
    return;
  }

  try {
    new File(uri).delete();
  } catch {
    // The cache can evict the file before we remove it.
  }
}

/** Prepares a photo for upload with a byte-size target and a bounded encode cost. */
export async function processImage(
  uri: string,
  width: number,
  height: number,
  { maxDimension = 1600, compress = 0.8, mimeType }: ProcessImageOptions = {},
) {
  const longestSide = Math.max(width, height);
  const filePath = uri.split("?")[0].toLowerCase();
  let originalMimeType = mimeType?.toLowerCase() ?? null;

  if (!originalMimeType && filePath.endsWith(".png")) {
    originalMimeType = "image/png";
  } else if (!originalMimeType && /\.jpe?g$/.test(filePath)) {
    originalMimeType = "image/jpeg";
  }

  const canKeepOriginal =
    longestSide <= maxDimension &&
    (originalMimeType === "image/png" || originalMimeType === "image/jpeg");
  const originalSize = canKeepOriginal ? getPhotoSize(uri) : undefined;
  const original = { uri, mimeType: originalMimeType, converted: false };

  if (
    canKeepOriginal &&
    (originalSize === undefined || originalSize <= TARGET_PHOTO_BYTES)
  ) {
    return original;
  }

  const context = ImageManipulator.manipulate(uri);
  const cachedUris: string[] = [];
  let selectedUri = uri;
  let image: ImageRef | undefined;

  try {
    if (longestSide > maxDimension) {
      context.resize({
        width: width >= height ? maxDimension : null,
        height: height > width ? maxDimension : null,
      });
    }

    image = await context.renderAsync();
    const first = await image.saveAsync({ compress, format: SaveFormat.JPEG });
    cachedUris.push(first.uri);

    let candidate = first;
    let candidateSize = getPhotoSize(first.uri);

    if (
      candidateSize !== undefined &&
      candidateSize > TARGET_PHOTO_BYTES &&
      compress > SMALLER_JPEG_QUALITY
    ) {
      const smaller = await image
        .saveAsync({
          compress: SMALLER_JPEG_QUALITY,
          format: SaveFormat.JPEG,
        })
        .catch(() => undefined);

      if (smaller) {
        cachedUris.push(smaller.uri);
        const smallerSize = getPhotoSize(smaller.uri);

        if (smallerSize !== undefined && smallerSize < candidateSize) {
          candidate = smaller;
          candidateSize = smallerSize;
        }
      }
    }

    if (
      originalSize !== undefined &&
      (candidateSize === undefined || originalSize <= candidateSize)
    ) {
      return original;
    }

    selectedUri = candidate.uri;
    return { uri: selectedUri, mimeType: "image/jpeg", converted: true };
  } finally {
    image?.release();
    context.release();

    for (const cachedUri of cachedUris) {
      if (cachedUri !== selectedUri) {
        deleteCachedPhoto(cachedUri);
      }
    }
  }
}
