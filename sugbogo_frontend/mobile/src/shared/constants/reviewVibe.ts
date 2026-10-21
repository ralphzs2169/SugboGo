import type { ReviewVibe } from "@/shared/types/reviewVibe.types";
import colors from "tailwindcss/colors";

/** Explicit native colors keep semantic badge colors reliable through text wrappers. */
export const REVIEW_VIBE_COLORS = {
  mostly_positive: {
    background: "#16A34A1A",
    foreground: colors.green[700],
    dot: colors.green[700],
    border: "#16A34A40",
  },
  mostly_neutral: {
    background: colors.slate[100],
    foreground: colors.slate[700],
    dot: colors.slate[600],
    border: colors.slate[300],
  },
  mostly_negative: {
    background: colors.red[50],
    foreground: colors.red[700],
    dot: colors.red[700],
    border: colors.red[200],
  },
  mixed: {
    background: colors.amber[50],
    foreground: colors.amber[800],
    dot: colors.amber[700],
    border: colors.amber[200],
  },
} satisfies Record<
  ReviewVibe,
  { background: string; foreground: string; dot: string; border: string }
>;

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
    textClassName: "text-green-700",
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
