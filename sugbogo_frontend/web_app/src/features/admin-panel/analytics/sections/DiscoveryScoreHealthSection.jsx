import { useState } from "react";
import { useDiscoveryScoreAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsReportExplanation from "../components/AnalyticsReportExplanation";
import { OperationsHelp } from "../components/OperationsStats";
import { formatCount, formatTimestamp } from "../utils/presentation";

const STATUSES = [
  { key: "fresh", label: "Fresh", tone: "text-success" },
  { key: "stale", label: "Stale", tone: "text-warning" },
  { key: "pending", label: "Pending", tone: "text-warning" },
  { key: "failed", label: "Failed", tone: "text-danger" },
];

/** Reads coverage counters from one minimal score-list request without duplicating its management page. */
export default function DiscoveryScoreHealthSection() {
  const [drawer, setDrawer] = useState(null);
  const query = useDiscoveryScoreAnalytics({ page_size: 1 });
  const state = useAnalyticsSectionState(query, "score-health", "Discovery Score health");
  const coverage = query.data?.coverage;
  const healthy = coverage?.active_businesses > 0
    && coverage.fresh === coverage.active_businesses
    && ["stale", "pending", "failed", "missing", "provisional"].every((key) => coverage[key] === 0);
  return (
    <>
      <AnalyticsSection title="Discovery Score Health" description="Current score freshness across active businesses." {...state}
        action={<AnalyticsDrilldown to="/admin-panel/analytics/discovery-scores">View Discovery Scores</AnalyticsDrilldown>}
        isEmpty={coverage?.active_businesses === 0}
        emptyMessage="No active businesses to assess."
        unavailable={query.data !== undefined && !coverage}
        unavailableMessage="Discovery Score health counts are unavailable."
        footer={<AnalyticsReportFooter title="Discovery Score Health" meta={{ generated_at: coverage?.snapshot_at }} hasData={Boolean(coverage)} onAbout={() => setDrawer("about")} onData={() => setDrawer("data")} />}
      >
        {/* Coverage uses global counters, never the single returned score row */}
        <div className="mb-4 flex items-start gap-1">
          <p className="min-w-0 text-sm text-text-secondary"><span className={`text-3xl font-semibold tabular-nums tracking-tight ${healthy ? "text-success" : "text-text-primary"}`}>{formatCount(coverage?.fresh)} / {formatCount(coverage?.active_businesses)}</span>{" "}<span className="mt-1 block">active businesses have fresh scores</span></p>
          <OperationsHelp label="About score freshness">Fresh scores are non-provisional scores calculated within the freshness threshold, with no pending refresh or recorded error. Status counts can overlap.</OperationsHelp>
        </div>
        <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUSES.map((status) => <div key={status.key}>
            <dt className="text-xs text-text-secondary">{status.label}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${coverage?.[status.key] > 0 ? status.tone : "text-text-primary"}`}>{formatCount(coverage?.[status.key])}</dd>
          </div>)}
        </dl>
        <p className="text-xs text-text-secondary">Missing {formatCount(coverage?.missing)} · Provisional {formatCount(coverage?.provisional)}</p>
      </AnalyticsSection>
      <AnalyticsDetailDrawer mode={drawer} onClose={() => setDrawer(null)} title="Discovery Score Health" report={query.data} interval="current snapshot" series={[]} showComparison={false}
        periodContent={<div className="space-y-2 text-sm text-text-secondary"><p>Current snapshot as of {formatTimestamp(coverage?.snapshot_at)} Philippine time. Selected dates do not filter this snapshot.</p><p>Freshness threshold: {formatCount(coverage?.max_score_age_hours)} hours.</p></div>}
        aboutContent={<pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(coverage, null, 2)}</pre>}
        dataContent={<div className="space-y-5">
          <AnalyticsSummary items={[{ label: "Active businesses", value: formatCount(coverage?.active_businesses) }]} />
          <AnalyticsExactTable caption="Current Discovery Score health counts" rows={[...STATUSES, { key: "missing", label: "Missing" }, { key: "provisional", label: "Provisional" }]} columns={[
            { key: "label", label: "Status" },
            { key: "count", label: "Active businesses", render: (row) => formatCount(coverage?.[row.key]) },
          ]} />
          <AnalyticsReportExplanation title="Discovery Score Health" report={query.data} />
        </div>}
      />
    </>
  );
}
