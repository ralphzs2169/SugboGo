import apiClient from "@/shared/api/apiClient.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import { getCommunityReviews } from "../communityReview.service";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
  type CommunityReviewListResponse,
} from "../../types/communityReview.types";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

const url = "/reviews/community/";

function filters(changes: Partial<CommunityReviewFilters>) {
  return { ...DEFAULT_COMMUNITY_REVIEW_FILTERS, ...changes };
}

describe("getCommunityReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { items: [], pagination: { has_next: false } },
    });
  });

  it("requests the Community endpoint with default filters and page one", async () => {
    await getCommunityReviews();

    expect(apiClient.get).toHaveBeenCalledWith(url, expect.anything());
    const params = (apiClient.get as jest.Mock).mock.calls[0][1]
      .params as URLSearchParams;
    expect(params.toString()).toBe("page=1");
  });

  it("serializes only active server-side filters", async () => {
    await getCommunityReviews(
      filters({
        ordering: "most_helpful",
        clusterId: 4,
        categoryIds: [9, 2, 9],
        specialtyTagId: 7,
        hasPhotos: true,
      }),
      3,
    );

    const params = (apiClient.get as jest.Mock).mock.calls[0][1]
      .params as URLSearchParams;
    expect(params.get("page")).toBe("3");
    expect(params.get("ordering")).toBe("most_helpful");
    expect(params.get("cluster")).toBe("4");
    expect(params.getAll("category")).toEqual(["2", "9"]);
    expect(params.get("specialty_tag")).toBe("7");
    expect(params.get("has_photos")).toBe("true");
  });

  it("omits inactive optional filters", async () => {
    await getCommunityReviews(filters({}), 2);

    const params = (apiClient.get as jest.Mock).mock.calls[0][1]
      .params as URLSearchParams;
    expect(params.toString()).toBe("page=2");
  });

  it("preserves the typed API response envelope", async () => {
    const response: ApiResponse<CommunityReviewListResponse> = {
      success: true,
      message: "Success.",
      data: {
        items: [],
        pagination: {
          page: 1,
          page_size: 10,
          total_items: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        },
      },
    };
    (apiClient.get as jest.Mock).mockResolvedValue(response);

    await expect(getCommunityReviews()).resolves.toBe(response);
  });
});
