import {
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

/**
 * Displays a compact metric trend indicator.
 *
 * Uses semantic styling and directional icons to communicate whether
 * a metric improved, declined, or remained unchanged.
 */
function MetricBadge({ variant, text }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-600 border-emerald-100/60",
    warning: "bg-amber-50 text-amber-600 border-amber-100/60",
    danger: "bg-rose-50 text-rose-600 border-rose-100/60",
    neutral: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${
        styles[variant] ?? styles.neutral
      }`}
    >
      {variant === "success" && <ArrowUp className="h-3 w-3 stroke-[3]" />}

      {variant === "danger" && <ArrowDown className="h-3 w-3 stroke-[3]" />}

      {variant === "warning" && (
        <TrendingDown className="h-3 w-3 stroke-[2.5]" />
      )}

      {variant === "neutral" && <Minus className="h-3 w-3 stroke-[3]" />}

      {text}
    </span>
  );
}

export default MetricBadge;
