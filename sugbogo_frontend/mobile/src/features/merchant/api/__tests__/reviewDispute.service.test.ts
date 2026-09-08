import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";

import * as reviewDisputeService from "../reviewDispute.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/shared/api/request.service", () => ({
  request: jest.fn(async (value) => value),
}));

const mockResponse = {
  success: true,
  message: "Success.",
  data: {},
};

describe("reviewDispute.service", () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);
    (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);
    (apiClient.delete as jest.Mock).mockResolvedValue(mockResponse);
  });

  it("loads the merchant dispute collection through the existing endpoint", async () => {
    await reviewDisputeService.getReviewDisputes();

    expect(apiClient.get).toHaveBeenCalledWith("/review-disputes/", {
      params: { page_size: 100 },
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("creates a dispute with reason and description only", async () => {
    await reviewDisputeService.createReviewDispute(
      42,
      "fake_review",
      "The review appears to be fabricated.",
    );

    expect(apiClient.post).toHaveBeenCalledWith("/review-disputes/review/42/", {
      reason: "fake_review",
      description: "The review appears to be fabricated.",
    });
  });

  it("uploads evidence separately after dispute creation", async () => {
    await reviewDisputeService.addReviewDisputeEvidence(7, {
      uri: "file:///receipt.jpg",
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      type: "image",
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/review-disputes/7/evidence/",
      expect.any(FormData),
    );
  });

  it("uses the established delete and withdraw endpoints", async () => {
    await reviewDisputeService.deleteReviewDisputeEvidence(9);
    await reviewDisputeService.withdrawReviewDispute(7);

    expect(apiClient.delete).toHaveBeenCalledWith(
      "/review-disputes/evidence/9/",
    );
    expect(apiClient.post).toHaveBeenCalledWith("/review-disputes/7/withdraw/");
  });
});
