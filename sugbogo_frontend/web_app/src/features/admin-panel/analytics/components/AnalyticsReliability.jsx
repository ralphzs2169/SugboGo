import { formatTimestamp } from "../utils/presentation";

/** Separates report updates, source availability and confirmed capture information. */
export default function AnalyticsReliability({ meta }) {
  if (!meta) return null;
  const reasons = meta.partial_reasons ?? [];
  return (
    <div className="space-y-2 text-sm text-text-secondary">
      {/* Reliability messages reflect metadata rather than inferring capture from updates. */}
      <h3 className="font-semibold text-text-primary">Data reliability</h3>
      <p>Last updated: {formatTimestamp(meta.generated_at)} Philippine time.</p>
      <p>Latest confirmed data: {meta.data_through ? `${formatTimestamp(meta.data_through)} Philippine time` : "Not available. The latest fully captured date has not been confirmed."}</p>
      <p>{meta.availability === "unavailable" ? "The data source is unavailable. This does not mean there was no activity." : meta.availability === "partial" ? "Some data may be missing or limited; see the notes below." : meta.availability === "available" ? "The data source was available when this report was prepared." : "Data source availability has not been confirmed."}</p>
      {meta.coverage_verified === false && <p>Complete recording has not been confirmed.</p>}
      {reasons.includes("best_effort_delivery") && <p>Some activity may not have been recorded.</p>}
      {reasons.includes("current_day_incomplete") && <p>Today&apos;s reporting period is still in progress.</p>}
      {reasons.includes("tracking_started_during_period") && <p>Tracking began during this reporting period.</p>}
      {reasons.includes("tracking_not_started_in_period") && <p>Recording had not begun during the selected period.</p>}
      {reasons.includes("data_lag") && <p>Confirmed data does not yet cover the end of the selected period.</p>}
    </div>
  );
}
