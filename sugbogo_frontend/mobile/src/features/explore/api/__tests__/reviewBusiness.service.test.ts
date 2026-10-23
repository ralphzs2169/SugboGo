import apiClient from "@/shared/api/apiClient.service";

import { getInstallationId } from "@/shared/api/storage.service";

import {
  createReview,
  deleteReview,
  getAllBusinessReviews,
  updateReview,
  getMyReviewReport,
  reportReview,
} from "../reviewBusiness.service";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReviewFilters,
} from "../../types/review.types";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn(),
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

const url = "/reviews/business/20/all/";

it("deletes the selected review through the existing authenticated endpoint", async () => {
  await deleteReview(17);
  expect(apiClient.delete).toHaveBeenCalledWith("/reviews/17/");
});

function filters(changes: Partial<BusinessReviewFilters>) {
  return { ...DEFAULT_BUSINESS_REVIEW_FILTERS, ...changes };
}

describe("reportReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the selected reason and optional reporter explanation", async () => {
    await reportReview(
      74,
      "private_information",
      "Private phone number posted.",
    );
    await reportReview(75, "spam");

    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/reviews/74/report/", {
      report_type: "private_information",
      explanation: "Private phone number posted.",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/reviews/75/report/", {
      report_type: "spam",
    });
  });
});

describe("getMyReviewReport", () => {
  it("retrieves the current user's report receipt from the review report route", async () => {
    await getMyReviewReport(74);
    expect(apiClient.get).toHaveBeenCalledWith("/reviews/74/report/");
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
    [filters({ needsReply: true }), { needs_reply: "true" }],
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

describe("review visibility request payloads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getInstallationId as jest.Mock).mockResolvedValue("stored-installation");
    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });
    (apiClient.patch as jest.Mock).mockResolvedValue({ success: true });
  });

  it("includes explicit true or false on creation", async () => {
    await createReview(20, "An excellent visit with friendly staff.", [], true);
    await createReview(
      20,
      "An excellent visit with friendly staff.",
      [],
      false,
    );
    const first = (apiClient.post as jest.Mock).mock.calls[0][1] as FormData;
    const second = (apiClient.post as jest.Mock).mock.calls[1][1] as FormData;
    expect(first.get("show_in_community")).toBe("true");
    expect(second.get("show_in_community")).toBe("false");
    expect(first.get("installation_id")).toBe("stored-installation");
    expect(second.get("installation_id")).toBe("stored-installation");
  });

  it("supports visibility-only edits without resending text or photos", async () => {
    await updateReview(8, undefined, [], undefined, false);
    const form = (apiClient.patch as jest.Mock).mock.calls[0][1] as FormData;
    expect(form.get("show_in_community")).toBe("false");
    expect(form.has("text")).toBe(false);
    expect(form.has("keep_photo_ids")).toBe(false);
  });

  it("omits the preference when an existing client does not supply it", async () => {
    await updateReview(8, "An updated review of this business.", [], []);
    const form = (apiClient.patch as jest.Mock).mock.calls[0][1] as FormData;
    expect(form.has("show_in_community")).toBe(false);
  });
});

describe("review photo retention multipart payloads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.patch as jest.Mock).mockResolvedValue({ success: true });
  });

  it("sends the explicit empty-array marker for removing all photos", async () => {
    await updateReview(8, undefined, [], []);

    const form = (apiClient.patch as jest.Mock).mock.calls[0][1] as FormData;
    expect(apiClient.patch).toHaveBeenCalledWith("/reviews/8/", form);
    expect(form.getAll("keep_photo_ids")).toEqual(["[]"]);
    expect(form.has("text")).toBe(false);
    expect(form.has("photos")).toBe(false);
  });

  it("keeps the empty-array marker when uploading replacement photos", async () => {
    await updateReview(8, undefined, [{ uri: "file:///replacement.jpg" }], []);

    const form = (apiClient.patch as jest.Mock).mock.calls[0][1] as FormData;
    expect(form.getAll("keep_photo_ids")).toEqual(["[]"]);
    expect(form.getAll("photos")).toHaveLength(1);
  });

  it("omits retention when existing photos should be preserved", async () => {
    await updateReview(8, "An updated review with the same photos.", []);

    const form = (apiClient.patch as jest.Mock).mock.calls[0][1] as FormData;
    expect(form.has("keep_photo_ids")).toBe(false);
  });

  it("preserves repeated integer fields for a retained subset", async () => {
    await updateReview(8, undefined, [], [12, 34]);

    const form = (apiClient.patch as jest.Mock).mock.calls[0][1] as FormData;
    expect(form.getAll("keep_photo_ids")).toEqual(["12", "34"]);
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

  it("bounds creation uploads separately without changing editing timeouts", async () => {
    await createReview(20, "A detailed review", [{ uri: "file:///photo.jpg" }]);
    expect(jest.mocked(apiClient.post).mock.calls[0][2]).toEqual({ timeout: 120_000 });
    await createReview(20, "A detailed review", []);
    expect(jest.mocked(apiClient.post).mock.calls[1][2]).toEqual({ timeout: 30_000 });
    await updateReview(18, "Updated text", []);
    expect(jest.mocked(apiClient.patch).mock.calls.at(-1)).toHaveLength(2);
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
