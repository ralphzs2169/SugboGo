import apiClient from "@/shared/api/apiClient.service";
import { recordRoutePlanningIntent } from "@/features/explore/api/routePlanningIntent.service";
import { getMerchantRoutePlanning } from "../merchantRoutePlanning.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));
describe("route intent transport", () => {
  beforeEach(() => {
    jest
      .mocked(apiClient.post)
      .mockResolvedValue({ data: { success: true, data: {} } });
    jest
      .mocked(apiClient.get)
      .mockResolvedValue({ data: { success: true, data: {} } });
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
