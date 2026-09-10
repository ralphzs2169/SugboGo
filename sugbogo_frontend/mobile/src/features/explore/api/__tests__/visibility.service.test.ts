import apiClient from "@/shared/api/apiClient.service";
import {
  getExploreBusinessDetail,
  pocketBusiness,
  removeBusinessFromPocket,
  recordBusinessImpressions,
  recordBusinessProfileVisit,
} from "../exploreBusiness.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("visibility transport", () => {
  beforeEach(() => {
    const response = { data: { success: true, data: {} } };
    (apiClient.post as jest.Mock).mockResolvedValue(response);
    (apiClient.get as jest.Mock).mockResolvedValue(response);
    (apiClient.delete as jest.Mock).mockResolvedValue(response);
  });

  it("sends only the backend batch field", async () => {
    await recordBusinessImpressions([12, 34]);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/explorer/explore/visibility/impressions/",
      { business_ids: [12, 34] },
    );
  });

  it("uses the profile ID endpoint without any identity or timestamp body", async () => {
    await recordBusinessProfileVisit(34);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/explorer/explore/businesses/34/profile-visit/",
    );
  });

  it("keeps data fetching and prefetching free of telemetry", async () => {
    await getExploreBusinessDetail(34);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("preserves pocket and unpocket transport with no extra SAVE call", async () => {
    await pocketBusiness(34);
    await removeBusinessFromPocket(34);
    expect((apiClient.post as jest.Mock).mock.calls).toEqual([
      ["/explorer/explore/businesses/34/pocket/"],
    ]);
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/explorer/explore/businesses/34/pocket/",
    );
  });

  it("normalizes tracking transport failure without throwing to the page", async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error("unavailable"));
    await expect(recordBusinessImpressions([12])).resolves.toMatchObject({
      success: false,
    });
  });
});
