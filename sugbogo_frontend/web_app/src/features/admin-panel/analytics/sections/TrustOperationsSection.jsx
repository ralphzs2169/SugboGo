import { useState } from "react";
import Tooltip from "@/shared/components/actions/Tooltip";
import { useAttentionQueueAnalytics, useChangeRequestAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import OperationsStats from "../components/OperationsStats";
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
    label: "Median resolution time",
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

/** Compares observed medians on one zero-based scale; missing samples never become zero. */
function ProcessingSpeed({ types }) {
  const rows = types.map((row) => ({
    ...row,
    median: row.turnaround?.sample_count > 0 ? row.turnaround?.median_hours ?? null : null,
  })).sort((left, right) => {
    if (left.median === null) return right.median === null ? 0 : 1;
    if (right.median === null) return -1;
    return right.median - left.median;
  });
  const maximum = Math.max(0, ...rows.map((row) => row.median ?? 0));
  return (
    <ol aria-label="Median resolution time by request type" className="space-y-3">
      {/* Exact text and proportional lengths remain useful with sparse or tiny durations. */}
      {rows.map((row) => (
        <li key={row.type} className="min-w-0">
          <Tooltip asChild place="top" openOnClick
            content={`${row.label}: ${formatDuration(row.median)} median resolution time · ${formatCount(row.turnaround?.sample_count)} valid decisions. Selected resolution period.`}
            closeEvents={{ blur: true }}
            globalCloseEvents={{ escape: true, clickOutsideAnchor: true, scroll: true, resize: true }}
            className="!z-50 max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal !px-3 !py-2 leading-relaxed"
          >
            <button type="button" aria-label={`${row.label}: ${formatDuration(row.median)} median resolution time; ${formatCount(row.turnaround?.sample_count)} valid decisions`}
              className="block w-full cursor-pointer rounded py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
            >
              <span className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 text-text-primary">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-text-primary">{formatDuration(row.median)}</span>
              </span>
              <span aria-hidden="true" className="block h-3 overflow-hidden rounded-sm bg-surface-muted">
                <span className="block h-full rounded-sm bg-info/75" style={{ width: maximum > 0 && row.median !== null ? `${row.median / maximum * 100}%` : "0%" }} />
              </span>
            </button>
          </Tooltip>
        </li>
      ))}
      {!rows.length && <li className="py-4 text-sm text-text-secondary">No request-type observations available.</li>}
    </ol>
  );
}

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
      <AnalyticsSection title="Merchant change requests" description="Current workload · selected-period processing." {...state}
        action={<AnalyticsDrilldown to="/admin-panel/businesses/update-requests">View change requests</AnalyticsDrilldown>}
        footer={<AnalyticsReportFooter title="Merchant change requests" meta={data?.meta} hasData={Boolean(data)} onAbout={() => setMode("about")} onData={() => setMode("data")} />}
      >
        {/* Compact statistics preserve snapshot and resolution-period scopes. */}
        <OperationsStats items={[
          { label: "Current workload", value: `${formatCount(data?.backlog?.total)} pending` },
          { label: "72h+", value: `${formatCount(data?.backlog?.days_3_plus)} overdue` },
          { label: "Median resolution time", value: formatDuration(data?.turnaround?.median_hours), help: `Selected resolution period · ${formatCount(data?.turnaround?.sample_count)} valid approval/rejection decisions. Merchant withdrawals are excluded.` },
        ]} />
        {/* Processing speeds share a proportional scale; aging stays in View data. */}
        <div className="mt-4 border-t border-stroke pt-4">
          <h3 className="text-sm font-semibold text-text-primary">Processing speed by request type</h3>
          <p className="mb-3 mt-1 text-xs text-text-secondary">Median resolution time · selected period</p>
          <ProcessingSpeed types={types} />
        </div>
        {/* Compact outcomes visually separate administrator decisions from merchant actions. */}
        <div className="mt-5 border-t border-stroke pt-4">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Outcomes by request type</h3>
          <div className="max-w-full overflow-x-auto rounded-lg border border-stroke">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Selected-period outcomes by request type. Approvals and rejections are administrator decisions; withdrawals are merchant actions.</caption>
              <thead className="bg-surface-muted text-text-primary">
                <tr className="text-xs text-text-secondary">
                  <th scope="col" rowSpan={2} className="px-3 py-2 font-medium">Request type</th>
                  <th scope="colgroup" colSpan={2} className="px-3 pt-2 text-center font-medium">Administrator decisions</th>
                  <th scope="colgroup" className="border-l border-stroke px-3 pt-2 text-center font-medium">Merchant action</th>
                </tr>
                <tr>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Approved</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Rejected</th>
                  <th scope="col" className="border-l border-stroke px-3 py-2 text-right font-medium">Withdrawn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke text-text-primary">
                {types.map((row) => (
                  <tr key={row.type}>
                    <th scope="row" className="px-3 py-2 font-normal">{row.label}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.period_outcomes?.approved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.period_outcomes?.rejected)}</td>
                    <td className="border-l border-stroke px-3 py-2 text-right tabular-nums">{formatCount(row.period_outcomes?.withdrawn)}</td>
                  </tr>
                ))}
                {!types.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-text-secondary">No request-type observations available.</td></tr>}
              </tbody>
            </table>
          </div>
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
            <h3 className="mb-2 font-semibold">Resolution-time samples</h3>
            <AnalyticsExactTable caption="Change-request resolution-time samples and exclusions" rows={[
              { label: "All requests", turnaround: data?.turnaround, missing_resolution_timestamp_count: data?.missing_resolution_timestamp_count },
              ...types,
            ]} columns={[
              { key: "label", label: "Request type" },
              { key: "median", label: "Median resolution time (hours, exact)", render: (row) => row.turnaround?.median_hours ?? "Unavailable" },
              { key: "mean", label: "Mean resolution time (hours, exact)", render: (row) => row.turnaround?.mean_hours ?? "Unavailable" },
              { key: "sample", label: "Valid decisions", render: (row) => formatCount(row.turnaround?.sample_count) },
              { key: "excluded", label: "Excluded durations", render: (row) => formatCount(row.turnaround?.excluded_count) },
              { key: "missing", label: "Missing resolution dates (all time)", render: (row) => formatCount(row.missing_resolution_timestamp_count) },
            ]} />
          </div>
        </div>}
        aboutContent={<div className="space-y-3 text-sm text-text-secondary">
          <p>{data?.definition?.replaceAll("administrator decision durations", "administrator resolution durations")}</p>
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
