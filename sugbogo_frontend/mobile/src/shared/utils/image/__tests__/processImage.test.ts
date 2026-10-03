import * as ImageManipulator from "expo-image-manipulator";

import { processImage } from "../processImage.utils";

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));

describe("processImage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps a small PNG and reports its actual MIME type", async () => {
    const result = await processImage("file:///photo.png", 800, 600, {
      mimeType: "image/png",
    });

    expect(result).toEqual({
      uri: "file:///photo.png",
      mimeType: "image/png",
      converted: false,
    });
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  it("converts an oversized image to JPEG at 1600 pixels", async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: "file:///processed.jpg",
    });

    const result = await processImage("file:///photo.png", 3200, 1600, {
      mimeType: "image/png",
    });

    expect(result).toEqual({
      uri: "file:///processed.jpg",
      mimeType: "image/jpeg",
      converted: true,
    });
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      "file:///photo.png",
      [{ resize: { width: 1600, height: 800 } }],
      { compress: 0.8, format: "jpeg" },
    );
  });
});
