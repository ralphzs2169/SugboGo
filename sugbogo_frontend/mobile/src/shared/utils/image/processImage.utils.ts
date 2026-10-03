import * as ImageManipulator from "expo-image-manipulator";

type ProcessImageOptions = {
  maxDimension?: number;
  compress?: number;
  mimeType?: string | null;
};

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

  if (
    longestSide <= maxDimension &&
    (originalMimeType === "image/png" || originalMimeType === "image/jpeg")
  ) {
    return {
      uri,
      mimeType: originalMimeType,
      converted: false,
    };
  }

  const scale = Math.min(1, maxDimension / longestSide);
  const actions =
    scale < 1
      ? [
          {
            resize: {
              width: Math.round(width * scale),
              height: Math.round(height * scale),
            },
          },
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    mimeType: "image/jpeg",
    converted: true,
  };
}
