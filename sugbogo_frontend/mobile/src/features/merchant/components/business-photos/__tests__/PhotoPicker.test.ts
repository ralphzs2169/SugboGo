import * as ImagePicker from "expo-image-picker";

import { processImage } from "@/shared/utils/image/processImage.utils";
import { pickBusinessPhotos } from "../PhotoPicker";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/shared/utils/image/processImage.utils", () => ({
  processImage: jest.fn(),
}));

describe("pickBusinessPhotos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({
      granted: true,
    });
  });

  it("returns no selection when the user cancels", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    });
    await expect(
      pickBusinessPhotos({ currentCount: 1, maxPhotos: 3 }),
    ).resolves.toEqual([]);
    expect(processImage).not.toHaveBeenCalled();
  });

  it("reports denied permission instead of treating it as cancellation", async () => {
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({ granted: false });
    await expect(
      pickBusinessPhotos({ currentCount: 1, maxPhotos: 3 }),
    ).rejects.toThrow("Permission to access photos was denied.");
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("propagates processing failure for actionable caller feedback", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///unreadable.jpg", width: 800, height: 600 }],
    });
    jest
      .mocked(processImage)
      .mockRejectedValueOnce(new Error("Unreadable image"));
    await expect(
      pickBusinessPhotos({ currentCount: 1, maxPhotos: 3 }),
    ).rejects.toThrow("Unreadable image");
  });

  it("rejects a selected original larger than 10 MB before processing", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///large.jpg",
          fileName: "large.jpg",
          fileSize: 10 * 1024 * 1024 + 1,
          mimeType: "image/jpeg",
          width: 800,
          height: 600,
        },
      ],
    });

    await expect(
      pickBusinessPhotos({
        currentCount: 0,
        maxPhotos: 3,
        maxOriginalSize: 10 * 1024 * 1024,
      }),
    ).rejects.toThrow("Each original photo must be 10 MB or smaller.");
    expect(processImage).not.toHaveBeenCalled();
  });

  it("preserves PNG filename and MIME when the image is not converted", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///small.png",
          fileName: "small.png",
          fileSize: 1000,
          mimeType: "image/png",
          width: 800,
          height: 600,
        },
      ],
    });
    (processImage as jest.Mock).mockResolvedValue({
      uri: "file:///small.png",
      mimeType: "image/png",
      converted: false,
    });

    const photos = await pickBusinessPhotos({
      currentCount: 1,
      maxPhotos: 3,
      maxOriginalSize: 10 * 1024 * 1024,
    });

    expect(photos[0]).toEqual({
      uri: "file:///small.png",
      fileName: "small.png",
      mimeType: "image/png",
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 2, quality: 1 }),
    );
  });

  it("rejects unsupported originals before conversion", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///photo.heic",
          fileName: "photo.heic",
          fileSize: 1200,
          mimeType: "image/heic",
          width: 800,
          height: 600,
        },
      ],
    });

    await expect(
      pickBusinessPhotos({
        currentCount: 0,
        maxPhotos: 3,
        maxOriginalSize: 10 * 1024 * 1024,
      }),
    ).rejects.toThrow("Choose a JPG, JPEG, or PNG photo.");
    expect(processImage).not.toHaveBeenCalled();
  });
});
