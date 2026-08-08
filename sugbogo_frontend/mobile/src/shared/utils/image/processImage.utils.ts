import * as ImageManipulator from "expo-image-manipulator";

type ProcessImageOptions = {
  maxDimension?: number;
  compress?: number;
};

export async function processImage(
  uri: string,
  width: number,
  height: number,
  { maxDimension = 1600, compress = 0.8 }: ProcessImageOptions = {},
) {
  const longestSide = Math.max(width, height);

  if (longestSide <= maxDimension) {
    return {
      uri,
      mimeType: "image/jpeg",
    };
  }

  const scale = maxDimension / longestSide;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        },
      },
    ],
    {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    uri: result.uri,
    mimeType: "image/jpeg",
  };
}
