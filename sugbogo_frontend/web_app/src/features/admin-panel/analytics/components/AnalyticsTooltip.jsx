import { formatCount, formatPercentage } from "../utils/presentation";

/** Shares chart-tooltip presentation while leaving report-specific values and labels explicit. */
export default function AnalyticsTooltip({ title, rows, note }) {
  return (
    <div role="tooltip" className="max-w-[min(20rem,80vw)] rounded-lg border border-stroke bg-background p-3 text-xs text-text-primary shadow-md">
      {/* Wrapping names and aligned values work for dates, sources and methods. */}
      <p className="font-semibold">{title}</p>
      {note && <p className="mt-1 text-text-secondary">{note}</p>}
      <dl className="mt-2 space-y-2">{rows.map((row) => <div key={row.label} className="flex items-start justify-between gap-4"><dt className="min-w-0 break-words">{row.color && <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: row.color }} />}{row.label}</dt><dd className="shrink-0 text-right font-semibold tabular-nums">{row.value}</dd></div>)}</dl>
    </div>
  );
}

/** Adapts categorical source and method tooltips without deriving new percentages. */
export function AnalyticsCategoryTooltip({ active, payload, unit, colors }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <AnalyticsTooltip title={row.label} rows={[
    { label: `Recorded ${unit}`, value: formatCount(row.count), color: colors?.[row.method] ?? row.color ?? "var(--color-primary)" },
    { label: "Share of recorded total", value: formatPercentage(row.share_percent) },
  ]} />;
}
