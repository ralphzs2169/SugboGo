import { getExploreBusinessDetail } from "@/features/explore/api/exploreBusiness.service";
import { getBusinessPocketMemberships } from "@/features/pockets/api/pockets.service";
import apiClient from "@/shared/api/apiClient.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

it("forwards the worker's cancellation signal through the existing read services", async () => {
  const controller = new AbortController();
  jest
    .mocked(apiClient.get)
    .mockResolvedValue({ data: { success: true, data: {} } });
  await getExploreBusinessDetail(21, controller.signal);
  await getBusinessPocketMemberships(21, controller.signal);
  expect(apiClient.get).toHaveBeenNthCalledWith(
    1,
    "/explorer/explore/businesses/21/",
    { signal: controller.signal },
  );
  expect(apiClient.get).toHaveBeenNthCalledWith(
    2,
    "/explorer/explore/businesses/21/pockets/",
    { signal: controller.signal },
  );
});
