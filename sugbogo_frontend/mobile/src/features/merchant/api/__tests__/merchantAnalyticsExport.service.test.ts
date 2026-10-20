import apiClient from "@/shared/api/apiClient.service";
import { getMerchantAnalyticsPdf } from "../merchantAnalyticsExport.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

function pdfResponse() {
  return {
    data: Uint8Array.from([37, 80, 68, 70, 45, 49]).buffer,
    headers: {
      "content-type": "application/pdf",
      "content-disposition":
        'attachment; filename="sugbogo-merchant-report-8-2026-10-01-2026-10-07.pdf"',
    },
  };
}

describe("private analytics export transport", () => {
  beforeEach(() => jest.mocked(apiClient.get).mockReset());

  it("uses the authenticated client, explicit dates and cancellation for a binary PDF", async () => {
    jest.mocked(apiClient.get).mockResolvedValueOnce(pdfResponse());
    const controller = new AbortController();
    const response = await getMerchantAnalyticsPdf("7", controller.signal);
    expect(response.success).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/analytics/premium/report/export/",
      expect.objectContaining({
        params: { period: "7", interval: "daily" },
        responseType: "arraybuffer",
        signal: controller.signal,
        headers: { Accept: "application/pdf" },
      }),
    );
    if (response.success) {
      expect(response.data.filename).toBe(
        "sugbogo-merchant-report-8-2026-10-01-2026-10-07.pdf",
      );
    }
  });

  it("preserves binary JSON entitlement errors instead of saving them as PDFs", async () => {
    const denial = {
      success: false,
      code: "PLUS_REQUIRED",
      message: "Merchant Plus is required.",
    };
    const bytes = Uint8Array.from(JSON.stringify(denial), (character) =>
      character.charCodeAt(0),
    );
    jest.mocked(apiClient.get).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: bytes.buffer },
    });
    await expect(getMerchantAnalyticsPdf("30")).resolves.toEqual(denial);
  });

  it("rejects a successful response without PDF content", async () => {
    const response = pdfResponse();
    response.headers["content-type"] = "application/json";
    jest.mocked(apiClient.get).mockResolvedValueOnce(response);
    await expect(getMerchantAnalyticsPdf("90")).resolves.toMatchObject({
      success: false,
      code: "INVALID_EXPORT",
    });
  });

  it("does not use unsafe attachment paths as local filenames", async () => {
    const response = pdfResponse();
    response.headers["content-disposition"] =
      'attachment; filename="../../private.pdf"';
    jest.mocked(apiClient.get).mockResolvedValueOnce(response);
    const result = await getMerchantAnalyticsPdf("90");
    if (!result.success) throw new Error("Expected PDF");
    expect(result.data.filename).toBe("sugbogo-merchant-report-90-days.pdf");
  });
});
