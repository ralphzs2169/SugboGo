import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import {
  pickReviewDisputeDocuments,
  pickReviewDisputeImages,
} from "../pickReviewDisputeEvidence.utils";
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({
  File: jest.fn(() => ({ exists: true })),
}));
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(File).mockImplementation(() => ({ exists: true }) as File);
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
});
test("permission denial is distinct from cancellation and remains retryable", async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as never);
  await expect(pickReviewDisputeImages(2)).rejects.toThrow("Photo access");
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValueOnce({ canceled: true } as never);
  await expect(pickReviewDisputeImages(2)).resolves.toEqual([]);
});
test("document picker does not request photo permissions and reports native rejection", async () => {
  jest
    .mocked(DocumentPicker.getDocumentAsync)
    .mockRejectedValueOnce(new Error("Native picker failure"));
  await expect(pickReviewDisputeDocuments(2)).rejects.toThrow(
    "Native picker failure",
  );
  expect(
    ImagePicker.requestMediaLibraryPermissionsAsync,
  ).not.toHaveBeenCalled();
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///receipt.pdf",
        name: "receipt.pdf",
        lastModified: 0,
        size: 12,
      },
    ],
  });
  await expect(pickReviewDisputeDocuments(2)).resolves.toEqual([
    expect.objectContaining({
      uri: "file:///receipt.pdf",
      mimeType: "application/pdf",
    }),
  ]);
});
test("missing cached images and documents are rejected before draft replacement", async () => {
  jest.mocked(File).mockImplementation(() => ({ exists: false }) as File);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///missing.jpg" }],
  } as never);
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [
      { uri: "file:///missing.pdf", name: "missing.pdf", lastModified: 0 },
    ],
  });
  await expect(pickReviewDisputeImages(1)).rejects.toThrow(
    "no longer available",
  );
  await expect(pickReviewDisputeDocuments(1)).rejects.toThrow(
    "no longer available",
  );
});
