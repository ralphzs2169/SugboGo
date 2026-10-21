import * as Sharing from "expo-sharing";
import { shareMerchantAnalyticsPdf } from "../merchantAnalyticsExportFile";

const mockDelete = jest.fn();
const mockWrite = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: class {
    exists = true;
    uri = "file:///cache/report.pdf";
    create = jest.fn();
    write = mockWrite;
    delete = mockDelete;
  },
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe("temporary report sharing", () => {
  const pdf = {
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    filename: "report.pdf",
  };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  });

  it("shares a PDF and deletes the temporary file after completion", async () => {
    await shareMerchantAnalyticsPdf(pdf, jest.fn());
    expect(mockWrite).toHaveBeenCalledWith(pdf.bytes);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///cache/report.pdf",
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("cleans up even when the native share operation fails", async () => {
    jest
      .mocked(Sharing.shareAsync)
      .mockRejectedValueOnce(new Error("Sharing failed"));
    await expect(shareMerchantAnalyticsPdf(pdf, jest.fn())).rejects.toThrow(
      "Sharing failed",
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("does not write or share after the owning session changes", async () => {
    await expect(
      shareMerchantAnalyticsPdf(pdf, () => {
        throw new Error("Session changed");
      }),
    ).rejects.toThrow("Session changed");
    expect(mockWrite).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
