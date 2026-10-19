import apiClient from "@/shared/api/apiClient.service";
import { recordBusinessProfileVisit } from "@/features/explore/api/exploreBusiness.service";
import { DISCOVERY_SOURCES } from "@/features/explore/constants/discoverySources";
import { getMerchantDiscoverySources } from "../merchantDiscoverySources.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));
beforeEach(() => {
  jest
    .mocked(apiClient.post)
    .mockResolvedValue({ data: { success: true, data: {} } });
  jest
    .mocked(apiClient.get)
    .mockResolvedValue({ data: { success: true, data: {} } });
});
it.each(DISCOVERY_SOURCES)(
  "sends only optional %s attribution, never client identity or time",
  async (source) => {
    await recordBusinessProfileVisit(42, source);
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/explorer/explore/businesses/42/profile-visit/",
      { discovery_source: source },
    );
  },
);
it("preserves old empty-body callers", async () => {
  await recordBusinessProfileVisit(42);
  expect(apiClient.post).toHaveBeenLastCalledWith(
    "/explorer/explore/businesses/42/profile-visit/",
  );
});
it.each(["7", "30", "90"] as const)(
  "requests the independent Standard period %s",
  async (period) => {
    const controller = new AbortController();
    await getMerchantDiscoverySources(period, controller.signal);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/analytics/standard/discovery-sources/",
      { params: { period }, signal: controller.signal },
    );
  },
);
