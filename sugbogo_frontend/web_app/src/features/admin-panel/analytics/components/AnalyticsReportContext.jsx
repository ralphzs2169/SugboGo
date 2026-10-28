import { Link } from "react-router-dom";
import { formatTimestamp } from "../utils/presentation";

/** Discloses reporting boundaries and source freshness without inventing a completeness watermark. */
export default function AnalyticsReportContext({ meta, asOf, children }) {
  if (!meta && !asOf && !children) return null;
  return (
    <div className="space-y-1 text-xs leading-relaxed text-text-secondary">
      {/* Effective dates and known source limitations */}
      {asOf ? <p>Current snapshot as of {formatTimestamp(asOf)} Manila time. Global dates do not filter this snapshot.</p> : meta?.period && <p>Reporting dates: {meta.period.start_date} to {meta.period.end_date} · Asia/Manila.</p>}
      {meta && <p>Report generated: {formatTimestamp(meta.generated_at)}. Data through: {formatTimestamp(meta.data_through)}.</p>}
      {children}
    </div>
  );
}

/** Navigates to an existing Admin destination without unsupported filter parameters. */
export function AnalyticsDrilldown({ to, children }) {
  return <Link to={to} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg px-2 py-1 text-sm font-medium text-text-primary underline decoration-stroke-strong underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-info">{/* Existing operational destination */}{children} →</Link>;
}

/** Shows selected-period totals and backend comparisons without a second bordered card. */
export function AnalyticsSummary({ items }) {
  return (
    <dl className="mb-5 flex flex-wrap gap-x-8 gap-y-4">
      {/* Unbordered report summary values */}
      {items.map((item) => <div key={item.label}><dt className="text-xs text-text-secondary">{item.label}</dt><dd className="mt-1 text-xl font-semibold text-text-primary">{item.value}</dd>{item.context && <dd className="mt-1 text-xs text-text-secondary">{item.context}</dd>}</div>)}
    </dl>
  );
}
