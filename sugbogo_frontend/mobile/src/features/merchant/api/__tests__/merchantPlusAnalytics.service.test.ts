import apiClient from "@/shared/api/apiClient.service";
import {
  getMerchantPlusPocket,
  getMerchantPlusReviewPerformance,
  getMerchantPlusSpecialties,
  getMerchantPlusStatus,
  getMerchantPlusVisibility,
  getMerchantPlusPeers,
  getMerchantPlusStoredInsights,
  getMerchantPlusProfileTiming,
  getMerchantPlusRecommendations,
  refreshMerchantPlusRecommendations,
} from "../merchantPlusAnalytics.service";
import {
  plusStatus,
  plusSuccess,
  visibilityReport,
} from "../../__tests__/merchantPlusAnalytics.fixtures";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

describe("Core Plus analytics transport", () => {
  it("preserves the backend PLUS_REQUIRED envelope for authoritative access handling", async () => {
    const denial = {
      success: false,
      code: "PLUS_REQUIRED",
      message: "Merchant Plus is required.",
    };
    jest.mocked(apiClient.get).mockRejectedValueOnce({
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
    [getMerchantPlusPeers, "peers"],
    [getMerchantPlusRecommendations, "recommendations"],
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

  it("leaves stored review-insight coverage independent of dashboard selections", async () => {
    jest
      .mocked(apiClient.get)
      .mockResolvedValue({ data: { success: true, data: {} } });
    const controller = new AbortController();
    await getMerchantPlusStoredInsights(controller.signal);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/analytics/premium/review-insights/",
      { signal: controller.signal },
    );
  });

  it("sends only the approved timing metric and selection", async () => {
    jest
      .mocked(apiClient.get)
      .mockResolvedValue({ data: { success: true, data: {} } });
    await getMerchantPlusProfileTiming({ period: "7" });
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/analytics/premium/engagement-heatmap/",
      { params: { period: "7", metric: "profile_visits" }, signal: undefined },
    );
  });

  it("posts explicit recommendation refresh dates in JSON and preserves a queued acknowledgement", async () => {
    const acknowledgement = {
      success: true,
      data: {
        request_id: "job",
        state: "pending",
        created: true,
        source_period: {},
      },
    };
    jest
      .mocked(apiClient.post)
      .mockResolvedValue({ status: 202, data: acknowledgement });
    await expect(
      refreshMerchantPlusRecommendations({ period: "90" }),
    ).resolves.toEqual(acknowledgement);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/merchant/analytics/premium/recommendations/refresh/",
      { period: "90" },
    );
  });
});
