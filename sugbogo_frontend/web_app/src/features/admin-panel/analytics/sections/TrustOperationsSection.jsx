import { useAttentionQueueAnalytics, useChangeRequestAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsReportContext, { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatHours } from "../utils/presentation";

const agingColumns = [
  { key: "label", label: "Queue" },
  ...[["total", "Pending"], ["under_1_day", "<24h"], ["days_1_to_2", "24–<72h"], ["days_3_plus", "72h+"], ["unknown_age", "Unknown age"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) })),
];

/** Keeps moderation queues independently recoverable from merchant change requests. */
export function ModerationWorkload({ period }) {
  const query = useAttentionQueueAnalytics(period);
  const state = useAnalyticsSectionState(query, "queues", "reports and disputes");
  const data = query.data;
  return (
    <AnalyticsSection title="Reports & disputes" description="Current backlog · selected-period resolution time." {...state} action={<AnalyticsDrilldown to="/admin-panel/moderation-integrity">View moderation</AnalyticsDrilldown>}
      footer={<AnalyticsReportContext meta={data?.turnaround_meta} asOf={data?.queue_meta?.as_of}><p>Current backlog cannot reconstruct historical queue size. Resolution values use the selected decision period. Withdrawn disputes are excluded from resolution turnaround.</p></AnalyticsReportContext>}
    >
      {/* Pending age bands are snapshots; resolution time uses selected-period decisions */}
      <AnalyticsSummary items={[{ label: "Pending review reports", value: formatCount(data?.open_reports?.total), context: `${formatCount(data?.open_reports?.days_3_plus)} aged 72h+` }, { label: "Pending disputes", value: formatCount(data?.open_disputes?.total), context: `${formatCount(data?.open_disputes?.days_3_plus)} aged 72h+` }, { label: "Median dispute resolution", value: formatHours(data?.completed_dispute_turnaround?.median_hours), context: `${formatCount(data?.completed_dispute_turnaround?.sample_count)} valid samples` }]} />
      <AnalyticsDisclosure label="Queue breakdown"><AnalyticsExactTable caption="Current moderation queue aging" rows={[{ label: "Reports", ...data?.open_reports }, { label: "Disputes", ...data?.open_disputes }]} columns={agingColumns} />
      <p className="mt-3 text-xs text-text-secondary">Invalid duration exclusions: {formatCount(data?.completed_dispute_turnaround?.excluded_invalid_duration_count)}. Missing resolution timestamps across all completed disputes: {formatCount(data?.completed_dispute_turnaround?.missing_resolution_timestamp_count)}.</p></AnalyticsDisclosure>
    </AnalyticsSection>
  );
}

/** Distinguishes current listing-change backlog from administrator decisions and merchant withdrawals. */
export function ChangeRequestWorkload({ period }) {
  const query = useChangeRequestAnalytics(period);
  const state = useAnalyticsSectionState(query, "changes", "merchant change requests");
  const data = query.data;
  return (
    <AnalyticsSection title="Merchant change requests" description="Current backlog · selected-period decisions." {...state} action={<AnalyticsDrilldown to="/admin-panel/businesses/update-requests">View change requests</AnalyticsDrilldown>}
      footer={<AnalyticsReportContext meta={data?.meta} asOf={data?.backlog_meta?.as_of}><p>Outcomes use selected resolution dates. Merchant withdrawals are separate outcomes, never administrator turnaround samples.</p></AnalyticsReportContext>}
    >
      {/* Current workload, selected-period outcomes and pooled turnaround */}
      <AnalyticsSummary items={[
        { label: "Pending change requests", value: formatCount(data?.backlog?.total) },
        { label: "72h+ change requests", value: formatCount(data?.backlog?.days_3_plus) },
        { label: "Median decision time", value: formatHours(data?.turnaround?.median_hours), context: `${formatCount(data?.turnaround?.sample_count)} valid samples` },
      ]} />
      <AnalyticsDisclosure label="Queue breakdown"><AnalyticsExactTable caption="Listing-change backlog by type" rows={(data?.types ?? []).map((row) => ({ label: row.label, ...row.backlog }))} columns={agingColumns} />
      <div className="mt-4"><AnalyticsSummary items={[
        { label: "Approved · selected period", value: formatCount(data?.period_outcomes?.approved) },
        { label: "Rejected · selected period", value: formatCount(data?.period_outcomes?.rejected) },
        { label: "Withdrawn · selected period", value: formatCount(data?.period_outcomes?.withdrawn) },
      ]} /></div>
      <p className="text-xs text-text-secondary">Turnaround exclusions: {formatCount(data?.turnaround?.excluded_count)}. Missing terminal resolution timestamps across all dates: {formatCount(data?.missing_resolution_timestamp_count)}.</p></AnalyticsDisclosure>
    </AnalyticsSection>
  );
}

/** Groups related operations without coupling the two report requests or Retry actions. */
export default function TrustOperationsSection({ period }) {
  return (
    <section aria-label="Trust & Operations" className="space-y-4">
      {/* Related operational reports retain independent states */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-2"><ModerationWorkload period={period} /><ChangeRequestWorkload period={period} /></div>
    </section>
  );
}
