import type {
  ReviewAuthor,
  ReviewPhoto,
} from "@/features/explore/types/review.types";
import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

export type ReviewDisputeStatus =
  "pending" | "upheld" | "dismissed" | "withdrawn";

export type ReviewDisputeReason =
  | "fake_review"
  | "did_not_visit"
  | "abusive_content"
  | "misleading_information"
  | "conflict_of_interest"
  | "other";

export type ReviewDisputeEvidenceType = "image" | "document";

export type ReviewDisputeEvidence = {
  id: number;
  type: ReviewDisputeEvidenceType;
  file_name: string | null;
  url: string;
  created_at: string;
};

export type DisputedReview = {
  id: number;
  text: string;
  status: string;
  created_at: string;
  author: ReviewAuthor;
  photos: ReviewPhoto[];
};

export type ReviewDispute = {
  id: number;
  review_id: number;
  business_id: number;
  reason: ReviewDisputeReason;
  description: string;
  status: ReviewDisputeStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  evidence: ReviewDisputeEvidence[];
  review: DisputedReview;
};

export type PreviousReviewDispute = Pick<
  ReviewDispute,
  | "id"
  | "reason"
  | "description"
  | "status"
  | "admin_notes"
  | "resolved_at"
  | "created_at"
  | "evidence"
>;

export type ReviewDisputeDetail = ReviewDispute & {
  attempt_number: number;
  previous_dispute_count: number;
  previous_disputes: PreviousReviewDispute[];
};

export type ReviewDisputeListResponse = {
  items: ReviewDispute[];
  pagination: ExploreBusinessPagination;
};

export type LocalReviewDisputeEvidence = {
  uri: string;
  fileName: string;
  mimeType: string;
  type: ReviewDisputeEvidenceType;
  fileSize?: number;
};
