import apiClient from "@/shared/api/apiClient.service";
import { getMapDirectoryPage } from "../mapDiscovery.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

it("requests bounded global pages with cancellation and no viewport", async () => {
  const payload = { success: true, data: { items: [] } };
  (apiClient.get as jest.Mock).mockResolvedValue({ data: payload });
  const controller = new AbortController();
  expect(await getMapDirectoryPage(2, controller.signal)).toBe(payload);
  expect(apiClient.get).toHaveBeenCalledWith(
    "/explorer/explore/map/businesses/",
    {
      params: expect.any(URLSearchParams),
      signal: controller.signal,
    },
  );
  expect(
    Object.fromEntries((apiClient.get as jest.Mock).mock.calls[0][1].params),
  ).toEqual({ page: "2", page_size: "200" });
});

it("supports server Open Now and an unfiltered ID lookup", async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({
    data: { success: true, data: {} },
  });
  await getMapDirectoryPage(1, undefined, { openNow: true, businessId: 42 });
  const params = (apiClient.get as jest.Mock).mock.calls[0][1]
    .params as URLSearchParams;
  expect(params.get("open_now")).toBe("true");
  expect(params.get("business")).toBe("42");
  expect(params.has("north")).toBe(false);
  expect(params.has("category")).toBe(false);
});
