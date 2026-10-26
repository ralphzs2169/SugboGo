import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  LocalReviewDisputeEvidence,
  ReviewDispute,
  ReviewDisputeDetail,
  ReviewDisputeEvidence,
  ReviewDisputeListResponse,
  ReviewDisputeReason,
} from "../types/review-disputes/reviewDispute.types";

export type ReviewDisputeFilter = "all" | "pending" | "resolved";

export function getReviewDisputes(
  page = 1,
  status: ReviewDisputeFilter = "all",
  pageSize = 10,
): Promise<ApiResponse<ReviewDisputeListResponse>> {
  return request(
    apiClient.get("/merchant/review-disputes/", {
      params: { page, status, page_size: pageSize },
    }),
  );
}

export function getReviewDispute(
  disputeId: number,
): Promise<ApiResponse<ReviewDisputeDetail>> {
  return request(apiClient.get(`/merchant/review-disputes/${disputeId}/`));
}

export function createReviewDispute(
  reviewId: number,
  reason: ReviewDisputeReason,
  description: string,
): Promise<ApiResponse<ReviewDispute>> {
  return request(
    apiClient.post(`/merchant/review-disputes/review/${reviewId}/`, {
      reason,
      description,
    }),
  );
}

export function addReviewDisputeEvidence(
  disputeId: number,
  evidence: LocalReviewDisputeEvidence,
): Promise<ApiResponse<ReviewDisputeEvidence>> {
  const form = new FormData();

  form.append("type", evidence.type);
  form.append("file", {
    uri: evidence.uri,
    name: evidence.fileName,
    type: evidence.mimeType,
  } as never);

  return request(
    apiClient.post(`/merchant/review-disputes/${disputeId}/evidence/`, form),
  );
}

export function deleteReviewDisputeEvidence(
  evidenceId: number,
): Promise<ApiResponse<{ evidence_id: number }>> {
  return request(
    apiClient.delete(`/merchant/review-disputes/evidence/${evidenceId}/`),
  );
}

export function withdrawReviewDispute(
  disputeId: number,
): Promise<ApiResponse<ReviewDispute>> {
  return request(
    apiClient.post(`/merchant/review-disputes/${disputeId}/withdraw/`),
  );
}
