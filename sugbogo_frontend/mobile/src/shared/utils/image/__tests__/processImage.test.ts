import { File } from "expo-file-system";
import { ImageManipulator } from "expo-image-manipulator";

import { processImage } from "../processImage.utils";

jest.mock("expo-file-system", () => ({ File: jest.fn() }));

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: "jpeg" },
}));

describe("processImage", () => {
  const sizes = new Map<string, number>();
  const deleteFile = jest.fn();
  const saveAsync = jest.fn();
  const releaseImage = jest.fn();
  const context = {
    resize: jest.fn(),
    renderAsync: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    sizes.clear();
    jest.mocked(File).mockImplementation(
      (uri) =>
        ({
          size: sizes.get(String(uri)) ?? 0,
          delete: () => deleteFile(uri),
        }) as File,
    );
    jest.mocked(ImageManipulator.manipulate).mockReturnValue(
      context as unknown as ReturnType<typeof ImageManipulator.manipulate>,
    );
    context.renderAsync.mockResolvedValue({ saveAsync, release: releaseImage });
  });

  it("keeps a small PNG and reports its actual MIME type", async () => {
    sizes.set("file:///photo.png", 500_000);

    const result = await processImage("file:///photo.png", 800, 600, {
      mimeType: "image/png",
    });

    expect(result).toEqual({
      uri: "file:///photo.png",
      mimeType: "image/png",
      converted: false,
    });
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });

  it("converts an oversized image to JPEG at 1600 pixels", async () => {
    sizes.set("file:///processed.jpg", 320_000);
    saveAsync.mockResolvedValue({ uri: "file:///processed.jpg" });

    const result = await processImage("file:///photo.png", 3200, 1600, {
      mimeType: "image/png",
    });

    expect(result).toEqual({
      uri: "file:///processed.jpg",
      mimeType: "image/jpeg",
      converted: true,
    });
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith(
      "file:///photo.png",
    );
    expect(context.resize).toHaveBeenCalledWith({ width: 1600, height: null });
    expect(saveAsync).toHaveBeenCalledTimes(1);
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.8, format: "jpeg" });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("compresses a photo over the byte target even when its dimensions fit", async () => {
    sizes.set("file:///photo.png", 1_200_000);
    sizes.set("file:///first.jpg", 620_000);
    sizes.set("file:///smaller.jpg", 420_000);
    saveAsync
      .mockResolvedValueOnce({ uri: "file:///first.jpg" })
      .mockResolvedValueOnce({ uri: "file:///smaller.jpg" });

    await expect(processImage("file:///photo.png", 1600, 1200)).resolves.toEqual({
      uri: "file:///smaller.jpg",
      mimeType: "image/jpeg",
      converted: true,
    });
    expect(context.resize).not.toHaveBeenCalled();
    expect(context.renderAsync).toHaveBeenCalledTimes(1);
    expect(saveAsync).toHaveBeenCalledTimes(2);
    expect(saveAsync).toHaveBeenLastCalledWith({ compress: 0.6, format: "jpeg" });
    expect(releaseImage).toHaveBeenCalledTimes(1);
    expect(context.release).toHaveBeenCalledTimes(1);
    expect(deleteFile.mock.calls).toEqual([["file:///first.jpg"]]);
  });

  it("keeps the original when encoding would increase the upload size", async () => {
    sizes.set("file:///photo.jpg", 550_000);
    sizes.set("file:///first.jpg", 720_000);
    sizes.set("file:///second.jpg", 610_000);
    saveAsync
      .mockResolvedValueOnce({ uri: "file:///first.jpg" })
      .mockResolvedValueOnce({ uri: "file:///second.jpg" });

    await expect(processImage("file:///photo.jpg", 1200, 1400)).resolves.toEqual({
      uri: "file:///photo.jpg",
      mimeType: "image/jpeg",
      converted: false,
    });
    expect(deleteFile.mock.calls).toEqual([
      ["file:///first.jpg"],
      ["file:///second.jpg"],
    ]);
  });

  it("uses the first result if the optional second encode fails", async () => {
    sizes.set("file:///processed.jpg", 640_000);
    saveAsync
      .mockResolvedValueOnce({ uri: "file:///processed.jpg" })
      .mockRejectedValueOnce(new Error("Unable to save JPEG"));

    await expect(processImage("file:///photo.jpg", 1600, 3200)).resolves.toEqual({
      uri: "file:///processed.jpg",
      mimeType: "image/jpeg",
      converted: true,
    });
    expect(context.resize).toHaveBeenCalledWith({ width: null, height: 1600 });
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
