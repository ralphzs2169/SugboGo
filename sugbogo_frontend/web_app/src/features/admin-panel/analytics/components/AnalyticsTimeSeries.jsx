import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount, formatDate, formatTimestamp } from "../utils/presentation";
import AnalyticsExactTable from "./AnalyticsExactTable";

/** Plots reporting buckets at their actual times without joining missing observations.
 * Solid/dashed series and an exact-value alternative avoid color-only interpretation.
 */
export default function AnalyticsTimeSeries({ rows = [], lines }) {
  const data = rows.map((row) => ({ ...row, time: Date.parse(row.start ?? `${row.date}T00:00:00+08:00`) }));
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      {/* Numeric time axis preserves temporal spacing and null gaps */}
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-stroke)" />
        <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={formatDate} minTickGap={35} tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
        <YAxis allowDecimals={false} width={48} tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
        <Tooltip labelFormatter={formatDate} formatter={(value, name) => [formatCount(value), name]} contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-stroke)", color: "var(--color-text-primary)", borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-text-primary">{value}</span>} />
        {lines.map((line, index) => (
          <Line key={line.key} dataKey={line.key} name={line.label} type="linear" connectNulls={false} stroke={index === 0 ? "var(--color-primary)" : "var(--color-info)"} strokeDasharray={index === 0 ? undefined : "5 4"} strokeWidth={2} dot={rows.length < 8 ? { r: 3 } : false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Keeps chart values keyboard-accessible in a native disclosure and compact table. */
export function AnalyticsSeriesValues({ title, rows = [], lines }) {
  return (
    <details className="mt-4">
      {/* Optional exact-value disclosure */}
      <summary className="cursor-pointer rounded py-2 text-sm font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info">View exact values: {title}</summary>
      <div className="mt-2 max-h-80 overflow-y-auto">
        <AnalyticsExactTable caption={title} rows={rows} columns={[
          { key: "date", label: "Calendar bucket", render: (row) => row.date },
          { key: "start", label: "Effective start · Manila", render: (row) => formatTimestamp(row.start) },
          { key: "end_exclusive", label: "Exclusive end · Manila", render: (row) => formatTimestamp(row.end_exclusive) },
          ...lines.map((line) => ({ key: line.key, label: line.label, render: (row) => formatCount(row[line.key]) })),
        ]} />
      </div>
    </details>
  );
}
