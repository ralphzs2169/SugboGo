import apiClient from "@/shared/api/apiClient.service";
import { getMapDiscoveryBusinesses } from "../mapDiscovery.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

it("uses the standard envelope with bounds, a bounded first page, and cancellation", async () => {
  const payload = { success: true, message: "Success", data: { items: [] } };
  (apiClient.get as jest.Mock).mockResolvedValue({ data: payload });
  const bounds = { north: 10.4, south: 10.3, east: 124, west: 123.9 };
  const controller = new AbortController();
  expect(await getMapDiscoveryBusinesses(bounds, controller.signal)).toBe(
    payload,
  );
  expect(apiClient.get).toHaveBeenCalledWith("/explorer/explore/map/", {
    params: { ...bounds, page: 1, page_size: 200 },
    signal: controller.signal,
  });
});

it("does not send invalid viewports even when called directly", async () => {
  await expect(
    getMapDiscoveryBusinesses({
      north: 11,
      south: 10,
      east: 124,
      west: 123.9,
    }),
  ).rejects.toThrow("Zoom in");
  expect(apiClient.get).not.toHaveBeenCalled();
});
