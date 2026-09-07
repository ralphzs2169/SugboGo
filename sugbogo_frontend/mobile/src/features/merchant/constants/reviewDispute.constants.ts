import type {
  ReviewDisputeReason,
  ReviewDisputeStatus,
} from "../types/review-disputes/reviewDispute.types";

export const MAX_REVIEW_DISPUTE_EVIDENCE = 5;
export const MAX_REVIEW_DISPUTE_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const REVIEW_DISPUTE_REASON_OPTIONS: {
  label: string;
  value: ReviewDisputeReason;
}[] = [
  { label: "Fake or fabricated review", value: "fake_review" },
  { label: "Reviewer did not visit the business", value: "did_not_visit" },
  { label: "Abusive or inappropriate content", value: "abusive_content" },
  { label: "Misleading information", value: "misleading_information" },
  { label: "Conflict of interest", value: "conflict_of_interest" },
  { label: "Other", value: "other" },
];

export const REVIEW_DISPUTE_REASON_LABELS = Object.fromEntries(
  REVIEW_DISPUTE_REASON_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ReviewDisputeReason, string>;

export const REVIEW_DISPUTE_STATUS_LABELS: Record<ReviewDisputeStatus, string> =
  {
    pending: "Pending",
    upheld: "Upheld",
    dismissed: "Dismissed",
    withdrawn: "Withdrawn",
  };
