import type { ReviewVibe } from "@/shared/types/reviewVibe.types";

export const OVERALL_REVIEW_VIBE_LABELS: Record<ReviewVibe, string> = {
  mostly_positive: "Mostly positive",
  mostly_neutral: "Mostly neutral",
  mostly_negative: "Mostly negative",
  mixed: "Mixed",
};

/** Soft surfaces and darker text keep the existing semantic categories readable. */
export const OVERALL_REVIEW_VIBE_STYLES = {
  mostly_positive: {
    containerClassName: "bg-success/10",
    dotClassName: "bg-green-700",
    textClassName: "text-green-800",
  },
  mostly_neutral: {
    containerClassName: "bg-slate-100",
    dotClassName: "bg-slate-600",
    textClassName: "text-slate-700",
  },
  mostly_negative: {
    containerClassName: "bg-text-error/10",
    dotClassName: "bg-text-error",
    textClassName: "text-red-700",
  },
  mixed: {
    containerClassName: "bg-amber-50",
    dotClassName: "bg-amber-700",
    textClassName: "text-amber-800",
  },
} satisfies Record<
  ReviewVibe,
  { containerClassName: string; dotClassName: string; textClassName: string }
>;
