import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { getMetricVariant } from "@/features/admin-panel/constants/metricVariants";
import MetricDonut from "./MetricDonut";
import MetricSparkline from "./MetricSparkline";

const TREND_ICONS = {
  up: ArrowUp,
  down: ArrowDown,
  unchanged: Minus,
};

/**
 * Displays one KPI value with optional historical or distribution
 * visualization and either a historical trend or contextual footer.
 */
function MetricCard({
  title,
  value,
  trend,
  sparklineData = [],
  distribution,
  footerLabel = "vs last week",
  footerValue,
  sparklineValueFormatter,
}) {
  const trendColor = trend ? getMetricVariant(trend.variant).text : null;

  const TrendIcon = trend ? (TREND_ICONS[trend.direction] ?? Minus) : null;

  const hasSparkline =
    sparklineData.filter(
      (item) => item.value !== null && item.value !== undefined,
    ).length >= 2;

  return (
    <div className="flex min-h-[165px] flex-col justify-between rounded-lg border border-stroke bg-background p-6 shadow-sm hover:shadow-md">
      {/* Card title */}
      <h3 className="max-w-[160px] text-[11px] font-bold uppercase leading-relaxed tracking-widest text-text-secondary">
        {title}
      </h3>

      {/* KPI value, context, and visualization */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-3xl font-bold tracking-tight text-text-primary">
            {value}
          </div>

          {trend && (
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <TrendIcon
                  className={`h-3 w-3 shrink-0 stroke-[3] ${trendColor}`}
                />

                <span className={`font-bold ${trendColor}`}>{trend.value}</span>
              </span>

              <span className="whitespace-nowrap text-text-secondary">
                {footerLabel}
              </span>
            </div>
          )}

          {!trend && footerValue && (
            <div className="mt-2 text-[11px] font-bold text-text-secondary">
              {footerValue}
            </div>
          )}
        </div>

        {/* KPI visualization */}
        {distribution ? (
          <MetricDonut data={distribution.data} />
        ) : (
          hasSparkline && (
            <div className="h-14 w-20 shrink-0">
              <MetricSparkline
                data={sparklineData}
                variant="neutral"
                valueFormatter={sparklineValueFormatter}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default MetricCard;
