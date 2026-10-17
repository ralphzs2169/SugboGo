import apiClient from "@/shared/api/apiClient.service";
import {
  getMerchantPlusPocket,
  getMerchantPlusReviewPerformance,
  getMerchantPlusSpecialties,
  getMerchantPlusStatus,
  getMerchantPlusVisibility,
} from "../merchantPlusAnalytics.service";
import {
  plusStatus,
  plusSuccess,
  visibilityReport,
} from "../../__tests__/merchantPlusAnalytics.fixtures";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("Core Plus analytics transport", () => {
  it("preserves the backend PLUS_REQUIRED envelope for authoritative access handling", async () => {
    const denial = {
      success: false,
      code: "PLUS_REQUIRED",
      message: "Merchant Plus is required.",
    };
    jest
      .mocked(apiClient.get)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 403, data: denial },
      });
    await expect(
      getMerchantPlusVisibility({ period: "30" }, "daily"),
    ).resolves.toEqual(denial);
  });
  it("reads parameter-free access status without activating entitlement", async () => {
    const response = plusSuccess(plusStatus());
    jest.mocked(apiClient.get).mockResolvedValue({ data: response });
    await expect(getMerchantPlusStatus()).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith("/merchant/plus/status/", {
      signal: undefined,
    });
  });
  it("preserves custom dates, interval, null comparisons and cancellation", async () => {
    const response = plusSuccess(visibilityReport());
    jest.mocked(apiClient.get).mockResolvedValue({ data: response });
    const controller = new AbortController();
    const selection = {
      period: "custom" as const,
      start_date: "2026-10-01",
      end_date: "2026-10-12",
    };
    await expect(
      getMerchantPlusVisibility(selection, "weekly", controller.signal),
    ).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/analytics/premium/visibility/",
      {
        params: { ...selection, interval: "weekly" },
        signal: controller.signal,
      },
    );
    expect(response.data.metrics.profile_visits.change.value).toBeNull();
  });
  it.each([
    [getMerchantPlusPocket, "pocket"],
    [getMerchantPlusSpecialties, "specialties"],
    [getMerchantPlusReviewPerformance, "review-performance"],
  ] as const)(
    "requests only the selected detail endpoint %s",
    async (read, path) => {
      jest
        .mocked(apiClient.get)
        .mockResolvedValue({ data: { success: true, data: {} } });
      await read({ period: "90" });
      expect(apiClient.get).toHaveBeenCalledWith(
        `/merchant/analytics/premium/${path}/`,
        { params: { period: "90" }, signal: undefined },
      );
    },
  );
});
