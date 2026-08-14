import { useId } from "react";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { getMetricVariant } from "@/features/admin-panel/constants/metricVariants";

/**
 * Renders a compact interactive KPI sparkline with a subtle area gradient.
 *
 * Hovering a point reveals the formatted date and metric value while
 * keeping the chart visually lightweight and free of axes.
 */
export default function MetricSparkline({
  data = [],
  variant = "neutral",
  valueFormatter = (value) => [value, "Value"],
}) {
  const gradientId = `metric-sparkline-${useId().replace(/:/g, "")}`;

  const points = data.filter(
    (item) => item.value !== null && item.value !== undefined,
  );

  if (points.length < 2) {
    return null;
  }

  const colorClass = getMetricVariant(variant).text;

  return (
    <div className={`h-full w-full ${colorClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{
            top: 6,
            right: 6,
            bottom: 4,
            left: 6,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis dataKey="date" hide />

          <Area
            type="monotone"
            dataKey="value"
            name="Metric"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={false}
            activeDot={{
              r: 4,
              strokeWidth: 2,
              fill: "currentColor",
            }}
          />

          <Tooltip
            cursor={{
              stroke: "currentColor",
              strokeOpacity: 0.15,
              strokeDasharray: "3 3",
            }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-stroke)",
              backgroundColor: "var(--color-background)",
              fontSize: "11px",
              padding: "6px 8px",
            }}
            labelStyle={{
              color: "var(--color-text-secondary)",
              marginBottom: "2px",
            }}
            formatter={(value) => valueFormatter(value)}
            labelFormatter={(date) =>
              new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
