import apiClient from "@/shared/api/apiClient.service";

import { getInstallationId } from "@/shared/api/storage.service";
import { createReview, getAllBusinessReviews, reportReview } from "../reviewBusiness.service";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReviewFilters,
} from "../../types/review.types";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn(),
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

const url = "/reviews/business/20/all/";

function filters(changes: Partial<BusinessReviewFilters>) {
  return { ...DEFAULT_BUSINESS_REVIEW_FILTERS, ...changes };
}

describe("reportReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the selected reason and optional reporter explanation", async () => {
    await reportReview(74, "private_information", "Private phone number posted.");
    await reportReview(75, "spam");

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/reviews/74/report/",
      {
        report_type: "private_information",
        explanation: "Private phone number posted.",
      },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/reviews/75/report/",
      { report_type: "spam" },
    );
  });
});

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

describe("createReview installation ID", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getInstallationId as jest.Mock).mockResolvedValue("stored-installation");
    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });
  });

  it("sends text, every photo, and the stored installation ID", async () => {
    await createReview(20, "A detailed review", [
      { uri: "file:///one.jpg" },
      { uri: "file:///two.jpg", fileName: "two.jpg", mimeType: "image/jpeg" },
    ]);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, form] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe("/reviews/business/20/");
    expect(form.get("text")).toBe("A detailed review");
    expect(form.get("installation_id")).toBe("stored-installation");
    expect(form.getAll("photos")).toHaveLength(2);
    expect(getInstallationId).toHaveBeenCalledTimes(1);
  });

  it("stops submission with a clear error when SecureStore fails", async () => {
    (getInstallationId as jest.Mock).mockRejectedValue(
      new Error("SecureStore unavailable"),
    );

    await expect(createReview(20, "A detailed review", [])).rejects.toThrow(
      "Unable to access this app's installation ID",
    );
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
