import apiClient from "@/shared/api/apiClient.service";
import { recordRoutePlanningIntent } from "@/features/explore/api/routePlanningIntent.service";
import { getMerchantRoutePlanning } from "../merchantRoutePlanning.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));
describe("route intent transport", () => {
  beforeEach(() => {
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest
      .mocked(apiClient.post)
      .mockResolvedValue({ data: { success: true, data: {} } });
    jest
      .mocked(apiClient.get)
      .mockResolvedValue({ data: { success: true, data: {} } });
  });
  afterEach(() => jest.restoreAllMocks());
  it("reports HTTP status while preserving the backend error envelope and omitting credentials", async () => {
    const response = {
      success: false,
      message: "Forbidden",
      code: "PERMISSION_DENIED",
    };
    jest.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: response },
      config: { headers: { Authorization: "secret-token" } },
    });
    expect(await recordRoutePlanningIntent(21, "ROAD_ROUTE")).toEqual(response);
    expect(console.warn).toHaveBeenCalledWith(
      "[route-intent] HTTP request failed",
      {
        method: "ROAD_ROUTE",
        status: 403,
      },
    );
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain(
      "secret-token",
    );
  });
  it.each(["ROAD_ROUTE", "JEEPNEY"] as const)(
    "sends only %s, without client identity, location or time",
    async (method) => {
      await recordRoutePlanningIntent(21, method);
      expect(apiClient.post).toHaveBeenLastCalledWith(
        "/explorer/explore/businesses/21/route-intent/",
        { navigation_method: method },
      );
    },
  );
  it.each(["7", "30", "90"] as const)(
    "reads the owned Standard report with period %s and cancellation",
    async (period) => {
      const controller = new AbortController();
      await getMerchantRoutePlanning(period, controller.signal);
      expect(apiClient.get).toHaveBeenLastCalledWith(
        "/merchant/analytics/standard/route-planning/",
        { params: { period }, signal: controller.signal },
      );
    },
  );
});
