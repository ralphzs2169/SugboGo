import type { OverallReviewVibe } from "../types/exploreBusiness.types";

export const OVERALL_REVIEW_VIBE_LABELS: Record<OverallReviewVibe, string> = {
  mostly_positive: "Mostly positive",
  mostly_neutral: "Mostly neutral",
  mostly_negative: "Mostly negative",
  mixed: "Mixed",
};

export const OVERALL_REVIEW_VIBE_STYLES: Record<
  OverallReviewVibe,
  {
    containerClassName: string;
    dotClassName: string;
    textClassName: string;
  }
> = {
  mostly_positive: {
    containerClassName: "bg-success",
    dotClassName: "bg-white",
    textClassName: "text-white",
  },
  mostly_neutral: {
    containerClassName: "bg-surface-muted",
    dotClassName: "bg-text-secondary",
    textClassName: "text-text-secondary",
  },
  mostly_negative: {
    containerClassName: "border border-border-error bg-error",
    dotClassName: "bg-text-error",
    textClassName: "text-text-error",
  },
  mixed: {
    containerClassName: "bg-surface-muted",
    dotClassName: "bg-text-secondary",
    textClassName: "text-text-secondary",
  },
};
