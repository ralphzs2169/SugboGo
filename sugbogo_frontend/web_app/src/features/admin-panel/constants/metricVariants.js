/**
 * Single source of truth for metric trend variant styling.
 *
 * Both the badge (header) and the footer trend text derive their
 * colors from here, so there's only one place to update if the
 * palette changes.
 */
export const METRIC_VARIANTS = {
  success: {
    badge: "bg-emerald-50 text-emerald-600 border-emerald-100/60",
    text: "text-emerald-600",
  },
  warning: {
    badge: "bg-amber-50 text-amber-600 border-amber-100/60",
    text: "text-amber-600",
  },
  danger: {
    badge: "bg-rose-50 text-rose-600 border-rose-100/60",
    text: "text-rose-600",
  },
  neutral: {
    badge: "bg-slate-50 text-slate-500 border-slate-200",
    text: "text-text-secondary",
  },
};

export function getMetricVariant(variant) {
  return METRIC_VARIANTS[variant] ?? METRIC_VARIANTS.neutral;
}
