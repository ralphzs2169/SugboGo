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
    containerClassName: "bg-slate-500",
    dotClassName: "bg-white",
    textClassName: "text-white",
  },
  mostly_negative: {
    containerClassName: "bg-text-error",
    dotClassName: "bg-white",
    textClassName: "text-white",
  },
  mixed: {
    containerClassName: "bg-amber-600",
    dotClassName: "bg-white",
    textClassName: "text-white",
  },
};
