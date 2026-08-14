import { ArrowDown, ArrowUp, Minus, TrendingDown } from "lucide-react";

import { getMetricVariant } from "../constants/metricVariants";

/**
 * Displays a compact metric trend indicator.
 *
 * Uses semantic styling and directional icons to communicate whether
 * a metric improved, declined, or remained unchanged.
 */
function MetricBadge({ variant, text }) {
  const { badge } = getMetricVariant(variant);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${badge}`}
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
