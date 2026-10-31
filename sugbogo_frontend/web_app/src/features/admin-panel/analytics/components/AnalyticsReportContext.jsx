import { Link } from "react-router-dom";

/** Navigates to an existing Admin destination without unsupported filter parameters. */
export function AnalyticsDrilldown({ to, children }) {
  return <Link data-analytics-action="navigation" to={to} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg px-2 py-1 text-sm font-medium text-text-primary underline decoration-stroke-strong underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-info">{/* Existing operational destination */}{children} →</Link>;
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
