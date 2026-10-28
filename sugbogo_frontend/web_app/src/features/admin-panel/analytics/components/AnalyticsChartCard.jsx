import AnalyticsSection from "./AnalyticsSection";

/** Gives a specific chart a stable plotting area and adjacent accessible explanation.
 * Chart configuration and exact-value text or tables remain with its consumer.
 */
export default function AnalyticsChartCard({ children, summary, accessibleData, ...section }) {
  return (
    <AnalyticsSection {...section}>
      {/* Chart and readable alternative */}
      <figure className="min-w-0">
        <div className="h-64 min-w-0 sm:h-72">{children}</div>
        {summary && <figcaption className="mt-3 text-sm leading-relaxed text-text-secondary">{summary}</figcaption>}
      </figure>
      {accessibleData}
    </AnalyticsSection>
  );
}
