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
    params: expect.any(URLSearchParams),
    signal: controller.signal,
  });
  expect(
    Object.fromEntries((apiClient.get as jest.Mock).mock.calls[0][1].params),
  ).toEqual({
    north: "10.4",
    south: "10.3",
    east: "124",
    west: "123.9",
    page: "1",
    page_size: "200",
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

it("serializes repeated categories and quick filters with the compact lookup ID", async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({
    data: { success: true, data: { items: [] } },
  });
  await getMapDiscoveryBusinesses(
    { north: 10.4, south: 10.3, east: 124, west: 123.9 },
    undefined,
    {
      clusterId: 1,
      categoryIds: [3, 4],
      specialtyTagId: 5,
      hiddenGems: true,
      openNow: true,
      businessId: 42,
    },
  );
  const params = (apiClient.get as jest.Mock).mock.calls[0][1]
    .params as URLSearchParams;
  expect(params.getAll("category")).toEqual(["3", "4"]);
  expect(params.get("cluster")).toBe("1");
  expect(params.get("specialty_tag")).toBe("5");
  expect(params.get("hidden_gems")).toBe("true");
  expect(params.get("open_now")).toBe("true");
  expect(params.get("business")).toBe("42");
});
