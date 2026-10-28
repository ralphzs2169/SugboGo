import { Link } from "react-router-dom";
import { formatTimestamp } from "../utils/presentation";
import AnalyticsDisclosure from "./AnalyticsDisclosure";

const clock = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** Discloses reporting boundaries and source freshness without inventing a completeness watermark. */
export default function AnalyticsReportContext({ meta, asOf, children }) {
  if (!meta && !asOf && !children) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-secondary">
      {/* Effective dates and known source limitations */}
      <span>Updated {(asOf ?? meta?.generated_at) ? clock.format(new Date(asOf ?? meta.generated_at)) : "Unknown"}</span>
      <AnalyticsDisclosure label="About this report">
      {asOf ? <p>Current snapshot as of {formatTimestamp(asOf)} Manila time. Global dates do not filter this snapshot.</p> : meta?.period && <p>Reporting dates: {meta.period.start_date} to {meta.period.end_date} · Asia/Manila.</p>}
      {asOf && meta?.period && <p>Period measures: {meta.period.start_date} to {meta.period.end_date} · Asia/Manila.</p>}
      {meta && <p>Report generated: {formatTimestamp(meta.generated_at)}. Data through: {formatTimestamp(meta.data_through)}.</p>}
      {meta && <p>Source availability: {meta.availability ?? "Unknown"}. Coverage verified: {meta.coverage_verified === true ? "Yes" : meta.coverage_verified === false ? "No" : "Unknown"}.</p>}
      {children}
      </AnalyticsDisclosure>
    </div>
  );
}

/** Navigates to an existing Admin destination without unsupported filter parameters. */
export function AnalyticsDrilldown({ to, children }) {
  return <Link to={to} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg px-2 py-1 text-sm font-medium text-text-primary underline decoration-stroke-strong underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-info">{/* Existing operational destination */}{children} →</Link>;
}

/** Shows selected-period totals and backend comparisons without a second bordered card. */
export function AnalyticsSummary({ items, compact = false }) {
  return (
    <dl className={compact ? "mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4" : "mb-3 flex flex-wrap gap-x-6 gap-y-3"}>
      {/* Unbordered report summary values */}
      {items.map((item) => <div key={item.label}><dt className="text-xs text-text-secondary">{item.label}</dt><dd className="mt-1 text-xl font-semibold text-text-primary">{item.value}</dd>{item.context && <dd className="mt-1 text-xs text-text-secondary">{item.context}</dd>}</div>)}
    </dl>
  );
}
