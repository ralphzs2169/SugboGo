import apiClient from "@/shared/api/apiClient.service";
import { getVouchHistory } from "../vouchHistory.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("vouch history transport", () => {
  it.each(["newest", "oldest"] as const)(
    "sends the %s ordering and requested page to the existing endpoint",
    async (ordering) => {
      const payload = {
        success: true,
        data: {
          items: [],
          summary: { total_businesses: 0, total_specialty_vouches: 0 },
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: payload });
      expect(await getVouchHistory(ordering, 2)).toEqual(payload);
      expect(apiClient.get).toHaveBeenCalledWith(
        "/explorer/explore/vouch-history/",
        { params: { ordering, page: 2 } },
      );
    },
  );

  it("normalizes a transport failure through the shared request wrapper", async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error("offline"));
    expect(await getVouchHistory("newest", 1)).toMatchObject({
      success: false,
    });
  });
});
