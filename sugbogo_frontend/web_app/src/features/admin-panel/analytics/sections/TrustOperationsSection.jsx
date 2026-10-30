import { useState } from "react";
import { useAttentionQueueAnalytics, useChangeRequestAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsReportContext, { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatDuration, formatHours, formatTimestamp } from "../utils/presentation";

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

const processingColumns = [
  { key: "label", label: "Request type" },
  { key: "pending", label: "Pending", render: (row) => formatCount(row.backlog?.total) },
  {
    key: "median",
    label: "Median decision time",
    render: (row) => (
      <div className="tabular-nums">
        <p className="whitespace-nowrap">{formatDuration(row.turnaround?.median_hours)}</p>
        <p className="mt-1 text-xs text-text-secondary">{formatCount(row.turnaround?.sample_count)} valid reviews</p>
      </div>
    ),
  },
  ...["approved", "rejected", "withdrawn"].map((key) => ({
    key,
    label: { approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" }[key],
    render: (row) => formatCount(row.period_outcomes?.[key]),
  })),
];

/** Compares request-type processing, keeping current queues separate from dated outcomes. */
export function ChangeRequestWorkload({ period }) {
  const [mode, setMode] = useState(null);
  const query = useChangeRequestAnalytics(period);
  const state = useAnalyticsSectionState(query, "changes", "merchant change requests");
  const data = query.data;
  const types = data?.types ?? [];
  const processingTable = (
    <AnalyticsExactTable caption="Merchant change request processing by type" rows={types} columns={processingColumns} />
  );
  return (
    <>
      <AnalyticsSection title="Merchant change requests" description="Current workload and request-type processing." {...state}
        action={<AnalyticsDrilldown to="/admin-panel/businesses/update-requests">View change requests</AnalyticsDrilldown>}
        footer={<AnalyticsReportFooter title="Merchant change requests" meta={data?.meta} hasData={Boolean(data)} onAbout={() => setMode("about")} onData={() => setMode("data")} />}
      >
        {/* Compact statistics preserve snapshot and decision-period scopes. */}
        <AnalyticsSummary items={[
          { label: "Current workload", value: `${formatCount(data?.backlog?.total)} pending`, context: `${formatCount(data?.backlog?.days_3_plus)} overdue (72h+)` },
          { label: "Median decision time", value: formatDuration(data?.turnaround?.median_hours), context: "Selected decision period" },
          { label: "Valid decision sample", value: formatCount(data?.turnaround?.sample_count), context: "Approved / rejected reviews with usable dates" },
        ]} />
        {/* Request-type comparison is primary; detailed aging remains in View data. */}
        <div className="mt-4 border-t border-stroke pt-4">
          <h3 className="text-sm font-semibold text-text-primary">Processing by request type</h3>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-text-secondary">Pending shows the current queue. Decisions and withdrawals use the selected resolution period. Withdrawals are merchant actions and are excluded from decision times.</p>
          {processingTable}
        </div>
      </AnalyticsSection>
      {/* Shared drawer retains exact outcomes, queue aging, exclusions and methodology. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Merchant change requests"
        report={data} interval="selected period" series={[]} showComparison={false}
        dataContent={<div className="space-y-5">
          <div><h3 className="mb-2 font-semibold">Processing by request type</h3>{processingTable}</div>
          <AnalyticsSummary items={[
            { label: "Approved", value: formatCount(data?.period_outcomes?.approved) },
            { label: "Rejected", value: formatCount(data?.period_outcomes?.rejected) },
            { label: "Withdrawn by merchants", value: formatCount(data?.period_outcomes?.withdrawn) },
          ]} />
          <div>
            <h3 className="mb-2 font-semibold">Current queue aging</h3>
            <p className="mb-3 text-xs text-text-secondary">As of {formatTimestamp(data?.backlog_meta?.as_of)} PHT. Selected dates do not filter pending requests. Missing or future submission dates have unknown age.</p>
            <AnalyticsExactTable caption="Current change-request queue aging" rows={[
              { label: "All requests", ...data?.backlog },
              ...types.map((row) => ({ label: row.label, ...row.backlog })),
            ]} columns={agingColumns} />
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Decision-time samples</h3>
            <AnalyticsExactTable caption="Change-request decision-time samples and exclusions" rows={[
              { label: "All requests", turnaround: data?.turnaround, missing_resolution_timestamp_count: data?.missing_resolution_timestamp_count },
              ...types,
            ]} columns={[
              { key: "label", label: "Request type" },
              { key: "median", label: "Median hours (exact)", render: (row) => row.turnaround?.median_hours ?? "Unavailable" },
              { key: "mean", label: "Mean hours (exact)", render: (row) => row.turnaround?.mean_hours ?? "Unavailable" },
              { key: "sample", label: "Valid decisions", render: (row) => formatCount(row.turnaround?.sample_count) },
              { key: "excluded", label: "Excluded durations", render: (row) => formatCount(row.turnaround?.excluded_count) },
              { key: "missing", label: "Missing resolution dates (all time)", render: (row) => formatCount(row.missing_resolution_timestamp_count) },
            ]} />
          </div>
        </div>}
        aboutContent={<div className="space-y-3 text-sm text-text-secondary">
          <p>{data?.definition}</p>
          <p>{data?.missing_resolution_timestamp_scope}</p>
          <pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ backlog: data?.backlog_meta, turnaround: data?.turnaround, types: data?.types }, null, 2)}</pre>
        </div>}
      />
    </>
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
