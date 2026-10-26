import { CancelledError } from "@tanstack/react-query";
import { CanceledError } from "axios";

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

const url = "/reviews/community/";

function filters(changes: Partial<CommunityReviewFilters>) {
  return { ...DEFAULT_COMMUNITY_REVIEW_FILTERS, ...changes };
}

describe("getCommunityReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: { items: [], pagination: { has_next: false } },
      },
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
    (apiClient.get as jest.Mock).mockResolvedValue({ data: response });

    await expect(getCommunityReviews()).resolves.toBe(response);
  });

  it("passes the query signal to Axios", async () => {
    const controller = new AbortController();
    await getCommunityReviews(
      DEFAULT_COMMUNITY_REVIEW_FILTERS,
      2,
      controller.signal,
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("does not start transport for an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      getCommunityReviews(
        DEFAULT_COMMUNITY_REVIEW_FILTERS,
        1,
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(CancelledError);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("preserves cancellation despite shared API error normalization", async () => {
    const controller = new AbortController();
    (apiClient.get as jest.Mock).mockImplementationOnce(async () => {
      controller.abort();
      throw new CanceledError();
    });

    await expect(
      getCommunityReviews(
        DEFAULT_COMMUNITY_REVIEW_FILTERS,
        1,
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(CancelledError);
  });
});
