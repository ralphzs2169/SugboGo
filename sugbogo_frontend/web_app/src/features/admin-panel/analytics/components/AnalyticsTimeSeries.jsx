import { useId } from "react";
import { Area, Bar, BarChart, ComposedChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount, formatDate, formatTimestamp } from "../utils/presentation";
import AnalyticsExactTable from "./AnalyticsExactTable";
import AnalyticsDisclosure from "./AnalyticsDisclosure";

/** Plots reporting buckets as lines by default, or independent bars for event counts.
 * Missing observations retain their buckets; exact-value alternatives remain shared.
 */
export default function AnalyticsTimeSeries({
  rows = [],
  lines,
  chartType = "line",
  showLegend = true,
  tooltipContent,
  legendContent,
  children,
  areaFade = false,
  timeDomain,
  timeTicks,
  barTimeAxis = false,
  maxBarSize = 28,
  barSize,
  barGap = 4,
  barCategoryGap = "28%",
  margin = { top: 8, right: 8, bottom: 0, left: 0 },
  yDomain,
}) {
  const gradientId = useId().replaceAll(":", "");
  const data = rows.map((row) => ({ ...row, time: Date.parse(row.start ?? `${row.date}T00:00:00+08:00`) }));
  const isBar = chartType === "bar";
  const Chart = isBar ? BarChart : areaFade ? ComposedChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      {/* Bar categories retain every reporting bucket; lines keep their numeric time axis */}
      <Chart
        data={data}
        margin={margin}
        {...(isBar ? { barCategoryGap, barGap, maxBarSize } : {})}
      >
        {children}
        {areaFade && !isBar && (
          <defs>
            {lines.map((line) => (
              <linearGradient key={line.key} id={`${gradientId}-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line.color ?? "var(--color-primary)"} stopOpacity={0.12} />
                <stop offset="100%" stopColor={line.color ?? "var(--color-primary)"} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
        )}
        <CartesianGrid vertical={false} stroke="var(--color-stroke)" strokeDasharray="3 4" />
        <XAxis dataKey={isBar && !barTimeAxis ? "date" : "time"} {...(isBar && !barTimeAxis ? { type: "category" } : { type: "number", scale: "time", domain: timeDomain ?? ["dataMin", "dataMax"], ticks: timeTicks, padding: isBar && barTimeAxis ? { left: maxBarSize / 2 + 8, right: maxBarSize / 2 + 8 } : undefined })} tickFormatter={formatDate} minTickGap={35} tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
        <YAxis domain={yDomain} allowDecimals={false} width={34} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
        <Tooltip content={tooltipContent} {...(isBar || areaFade ? { filterNull: false } : {})} labelFormatter={formatDate} formatter={(value, name) => [formatCount(value), name]} contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-stroke)", color: "var(--color-text-primary)", borderRadius: 8 }} />
        {showLegend && <Legend content={legendContent} wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-text-primary">{value}</span>} />}
        {areaFade && !isBar && lines.map((line) => (
          <Area
            key={`area-${line.key}`}
            dataKey={line.key}
            type="linear"
            connectNulls={false}
            baseValue={0}
            stroke="none"
            fill={`url(#${gradientId}-${line.key})`}
            isAnimationActive={false}
            tooltipType="none"
            legendType="none"
          />
        ))}
        {lines.map((line, index) => (
          isBar ? (
            <Bar
              key={line.key}
              dataKey={line.key}
              name={line.label}
              barSize={barSize}
              minPointSize={0}
              fill={line.color ?? "var(--color-primary)"}
              isAnimationActive={false}
            />
          ) : (
            <Line key={line.key} dataKey={line.key} name={line.label} type="linear" connectNulls={false} stroke={line.color ?? (index === 0 ? "var(--color-primary)" : "var(--color-info)")} strokeDasharray={index === 0 ? undefined : "5 4"} strokeWidth={2} dot={rows.length < 8 ? { r: 3 } : false} isAnimationActive={false} />
          )
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Keeps chart values keyboard-accessible in a native disclosure and compact table. */
export function AnalyticsSeriesValues({ title, rows = [], lines, label }) {
  return (
    <AnalyticsDisclosure label={label ?? `View exact values: ${title}`}>
      {/* Optional exact-value disclosure */}
      <div className="mt-2 max-h-80 overflow-y-auto">
        <AnalyticsExactTable caption={title} rows={rows} columns={[
          { key: "date", label: "Calendar bucket", render: (row) => row.date },
          { key: "start", label: "Effective start · Manila", render: (row) => formatTimestamp(row.start) },
          { key: "end_exclusive", label: "Exclusive end · Manila", render: (row) => formatTimestamp(row.end_exclusive) },
          ...lines.map((line) => ({ key: line.key, label: line.label, render: (row) => formatCount(row[line.key]) })),
        ]} />
      </div>
    </AnalyticsDisclosure>
  );
}
