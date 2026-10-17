import apiClient from "@/shared/api/apiClient.service";
import { getMyPockets, removeBusinessFromPocket } from "../exploreBusiness.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({ request: (value: unknown) => value }));

it("requests the current user's pockets with server pagination and search", async () => {
  (apiClient.get as jest.Mock).mockResolvedValue({ success: true });
  await getMyPockets(2, "cafe");
  expect(apiClient.get).toHaveBeenCalledWith("/explorer/explore/pockets/", {
    params: { page: 2, search: "cafe" },
  });
});

it("removes a pocket through the existing business endpoint", async () => {
  (apiClient.delete as jest.Mock).mockResolvedValue({ success: true });
  await removeBusinessFromPocket(77);
  expect(apiClient.delete).toHaveBeenCalledWith("/explorer/explore/businesses/77/pocket/");
});
