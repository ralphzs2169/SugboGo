import apiClient from "@/shared/api/apiClient.service";
import { getMyReviews } from "../myReviews.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("getMyReviews", () => {
  it.each([1, 3])(
    "requests author history page %i without a client identity",
    async (page) => {
      const envelope = { success: true, data: { items: [] } };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: envelope });
      expect(await getMyReviews(page)).toEqual(envelope);
      expect(apiClient.get).toHaveBeenLastCalledWith("/reviews/mine/", {
        params: { page, status: "all", ordering: "newest" },
      });
    },
  );
});
