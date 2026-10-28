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
 * Displays one KPI value with optional historical, distribution, or
 * contextual visualization and either a historical trend or footer.
 * Missing values remain unavailable, with optional measurement and source context.
 */
function MetricCard({
  title,
  icon: Icon,
  value,
  trend,
  sparklineData = [],
  distribution,
  visualization,
  footerLabel = "vs last week",
  footerValue,
  sparklineValueFormatter,
  measurementLabel,
  context,
  wrapTitle = false,
  unavailableLabel = "Unavailable",
}) {
  const trendColor = trend ? getMetricVariant(trend.variant).text : null;

  const TrendIcon = trend ? (TREND_ICONS[trend.direction] ?? Minus) : null;

  const hasSparkline =
    sparklineData.filter(
      (item) => item.value !== null && item.value !== undefined,
    ).length >= 2;

  return (
    <div className="flex min-h-[165px] flex-col overflow-hidden rounded-xl border border-stroke bg-background transition-shadow hover:shadow-md">
      {/* Metric header */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-4 py-3">
        <h3 className={`min-w-0 text-xs font-medium text-text-primary ${wrapTitle ? "break-words" : "truncate"}`}>
          {title}
        </h3>

        {Icon && (
          <div className="text-text-primary">
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* KPI body */}
      <div className="flex flex-1 items-end justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="break-words text-3xl font-bold tracking-tight text-text-primary">
            {value ?? unavailableLabel}
          </div>

          {trend && (
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <TrendIcon
                  aria-hidden="true"
                  className={`h-3 w-3 shrink-0 stroke-[3] ${trendColor}`}
                />

                <span className="sr-only">
                  {trend.direction === "up" ? "Increase: " : trend.direction === "down" ? "Decrease: " : "Unchanged: "}
                </span>
                <span className={`font-bold ${trendColor}`}>{trend.value}</span>
              </span>

              <span className="whitespace-nowrap text-text-secondary">
                {footerLabel}
              </span>
            </div>
          )}

          {!trend && footerValue != null && footerValue !== "" && (
            <div className="mt-2 text-[11px] font-bold text-text-secondary">
              {footerValue}
            </div>
          )}

          {/* Measurement scope and explanatory context */}
          {measurementLabel && <p className="mt-3 text-xs text-text-secondary">{measurementLabel}</p>}
          {context && <div className="mt-2 text-sm leading-relaxed text-text-secondary">{context}</div>}
        </div>

        {/* KPI visualization */}
        {visualization ? (
          visualization
        ) : distribution ? (
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
