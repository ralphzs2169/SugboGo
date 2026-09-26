import apiClient from "@/shared/api/apiClient.service";

import { getAllBusinessReviews } from "../reviewBusiness.service";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReviewFilters,
} from "../../types/review.types";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

const url = "/reviews/business/20/all/";

function filters(changes: Partial<BusinessReviewFilters>) {
  return { ...DEFAULT_BUSINESS_REVIEW_FILTERS, ...changes };
}

describe("getAllBusinessReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { items: [], pagination: { has_next: false } },
    });
  });

  it("requests page one when filters are absent or default", async () => {
    await getAllBusinessReviews(20);
    await getAllBusinessReviews(20, filters({}));

    expect(apiClient.get).toHaveBeenNthCalledWith(1, url, {
      params: { page: "1" },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, url, {
      params: { page: "1" },
    });
  });

  it.each([
    [filters({ sentiment: "positive" }), { sentiment: "positive" }],
    [filters({ sentiment: "negative" }), { sentiment: "negative" }],
    [filters({ topic: "Friendly service" }), { topic: "Friendly service" }],
    [filters({ hasPhotos: true }), { has_photos: "true" }],
    [filters({ merchantReplied: true }), { merchant_replied: "true" }],
    [filters({ ordering: "oldest" }), { ordering: "oldest" }],
    [filters({ ordering: "most_liked" }), { ordering: "most_liked" }],
  ])("sends only the active criterion", async (criteria, params) => {
    await getAllBusinessReviews(20, criteria);

    expect(apiClient.get).toHaveBeenCalledWith(url, {
      params: { page: "1", ...params },
    });
  });

  it("sends composed criteria without false or null parameters", async () => {
    await getAllBusinessReviews(
      20,
      filters({
        sentiment: "neutral",
        topic: "Friendly service",
        hasPhotos: true,
        merchantReplied: true,
        ordering: "most_liked",
      }),
    );

    expect(apiClient.get).toHaveBeenCalledWith(url, {
      params: {
        page: "1",
        sentiment: "neutral",
        topic: "Friendly service",
        has_photos: "true",
        merchant_replied: "true",
        ordering: "most_liked",
      },
    });
  });

  it("sends the requested page with active filters", async () => {
    await getAllBusinessReviews(
      20,
      filters({ sentiment: "positive", ordering: "most_liked" }),
      3,
    );

    expect(apiClient.get).toHaveBeenCalledWith(url, {
      params: {
        page: "3",
        sentiment: "positive",
        ordering: "most_liked",
      },
    });
  });

  it("uses a requested page size for the existing merchant collection", async () => {
    await getAllBusinessReviews(20, undefined, 2, 100);

    expect(apiClient.get).toHaveBeenCalledWith(url, {
      params: { page: "2", page_size: "100" },
    });
  });
});
