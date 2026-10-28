import { useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { useOnboardingAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsTimeSeries from "../components/AnalyticsTimeSeries";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsRanking from "../components/AnalyticsRanking";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatHours, formatPercentage, formatTimestamp } from "../utils/presentation";
import { growthBucketLabel } from "../utils/growthPresentation";

const LINES = [
  { key: "submissions", label: "Submissions", color: "var(--color-primary)" },
  { key: "completed_reviews", label: "Completed reviews", color: "var(--color-info)" },
];

/** Formats persisted hour durations without coercing unavailable samples to zero. */
function readableDuration(hours) {
  if (hours == null) return "Unavailable";
  if (hours === 0) return "0 min";
  const minutes = Math.round(hours * 60);
  if (minutes < 1) return "<1 min";
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [wholeHours ? `${wholeHours} hr` : "", remainder ? `${remainder} min` : ""].filter(Boolean).join(" ");
}

/** Shows effective weekly bounds and both independent workload counts. */
function WorkloadTooltip({ active, payload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-stroke bg-background p-3 text-xs text-text-primary shadow-lg">
      {/* Effective dates and exact workload counts */}
      <p className="mb-2 font-semibold">{growthBucketLabel(row)}</p>
      <dl className="space-y-1">
        {LINES.map((line) => <div key={line.key} className="flex items-center justify-between gap-5"><dt>{line.label}</dt><dd className="font-semibold tabular-nums">{formatCount(row[line.key])}</dd></div>)}
      </dl>
    </div>
  );
}

/** Makes paired event workloads primary while retaining current and cumulative scope distinctions. */
export default function OnboardingSection({ period }) {
  const [mode, setMode] = useState(null);
  const query = useOnboardingAnalytics(period);
  const state = useAnalyticsSectionState(query, "onboarding", "merchant onboarding");
  const data = query.data;
  const aging = data?.pending_aging;
  const duration = data?.review_turnaround;
  const rejected = data?.rejection_insights;
  const meta = data?.processing_meta ?? data?.meta;
  const sections = [...(rejected?.sections ?? [])].sort((left, right) => right.rejection_decisions - left.rejection_decisions);
  const actionStyle = "inline-flex cursor-pointer items-center gap-1.5 rounded py-2 text-xs font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info";
  const breakdown = (
    <AnalyticsExactTable caption="Rejected application sections" rows={sections} columns={[
      { key: "label", label: "Section" },
      { key: "rejection_decisions", label: "Rejection decisions", render: (row) => formatCount(row.rejection_decisions) },
      { key: "distinct_applications", label: "Distinct applications", render: (row) => formatCount(row.distinct_applications) },
      { key: "decision_share_percentage", label: "Share of decisions", render: (row) => formatPercentage(row.decision_share_percentage) },
    ]} />
  );
  return (
    <>
      <AnalyticsSection title="Merchant Onboarding" description="Application volume, processing efficiency, and rejection patterns." {...state}
        action={<AnalyticsDrilldown to="/admin-panel/businesses/applications">View applications</AnalyticsDrilldown>}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stroke pt-3 text-xs text-text-secondary">
            <span>Updated {formatTimestamp(meta?.generated_at)} (PHT){meta?.is_partial ? " · Partial coverage" : ""}</span>
            <button type="button" disabled={!data} onClick={() => setMode("about")} className={actionStyle}>About this report <Info aria-hidden="true" className="h-3.5 w-3.5" /></button>
          </div>
        }
      >
        {/* Paired analytical panels retain every rejection section and weekly bucket */}
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">Application workload</h3>
            <p className="mt-1 text-xs text-text-secondary">Submissions vs completed reviews</p>
            <div className="mt-3 h-56 min-w-0"><AnalyticsTimeSeries chartType="bar" rows={data?.weekly_activity} lines={LINES} tooltipContent={<WorkloadTooltip />} /></div>
            <button type="button" onClick={() => setMode("data")} className={actionStyle}>View data <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Rejection breakdown</h3>
            <AnalyticsRanking label="Rejected application sections" rows={sections.map((row) => ({ id: row.section, name: row.label, value: row.rejection_decisions }))} />
            <p className="mt-3 text-xs text-text-secondary">Sections may overlap. One rejection decision can include multiple sections.</p>
            <button type="button" onClick={() => setMode("breakdown")} className={actionStyle}>View breakdown <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {/* Unbordered statistics make their different populations explicit */}
        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-stroke pt-4 sm:grid-cols-3">
          <div><dt className="text-xs text-text-secondary">Pending / overdue</dt><dd className="mt-1 text-lg font-semibold text-text-primary">{formatCount(data?.legacy_statistics?.pending_review)} / {formatCount(aging?.overdue)}</dd><dd className="mt-1 text-xs text-text-secondary">Current snapshot</dd></div>
          <div><dt className="text-xs text-text-secondary">SLA compliance</dt><dd className="mt-1 text-lg font-semibold text-text-primary">{formatPercentage(data?.legacy_statistics?.sla_compliance_rate)}</dd><dd className="mt-1 text-xs text-text-secondary">All classified recorded reviews</dd></div>
          <div><dt className="text-xs text-text-secondary">Median review turnaround</dt><dd className="mt-1 text-lg font-semibold text-text-primary">{readableDuration(duration?.median_hours)}</dd><dd className="mt-1 text-xs text-text-secondary">Selected decision period</dd></div>
        </dl>
        {/* Recovery is cumulative, never presented as a period-filtered trend */}
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-stroke pt-4">
          <div><h3 className="text-sm font-semibold text-text-primary">Post-rejection recovery</h3><p className="mt-1 text-xs text-text-secondary">Applications that resubmitted after rejection.</p><p className="mt-1 text-xs text-text-secondary">All-time · as of now</p></div>
          <p className="text-xl font-semibold tabular-nums text-text-primary">{formatPercentage(data?.legacy_statistics?.resubmission_rate)}</p>
        </div>
      </AnalyticsSection>
      {/* The existing drawer owns exact data, full breakdown and report methodology */}
      <AnalyticsDetailDrawer mode={mode === "breakdown" ? "about" : mode} onClose={() => setMode(null)} title={mode === "breakdown" ? "Onboarding rejection breakdown" : "Merchant Onboarding"}
        report={{ ...data, meta, series: data?.weekly_activity }} interval="weekly" series={LINES} showComparison={false}
        dateColumn={{ key: "date", label: "Effective dates", render: growthBucketLabel }}
        aboutContent={<div className="space-y-4 border-t border-stroke pt-4 text-sm text-text-secondary">
          {mode === "breakdown" && breakdown}
        <p>Pending, on-time, approaching and overdue counts are current snapshots. Aging counts weekdays excluding submission day, without holidays.</p>
        <AnalyticsSummary items={[
          { label: "On time", value: formatCount(aging?.on_time) }, { label: "Approaching SLA", value: formatCount(aging?.approaching) },
          { label: "Unknown age", value: formatCount(aging?.unknown_age) }, { label: "Approaching / overdue business days", value: `${formatCount(data?.aging_meta?.approaching_business_days)} / ${formatCount(data?.aging_meta?.overdue_business_days)}` },
          { label: "Mean review turnaround", value: formatHours(duration?.mean_hours) }, { label: "Valid samples", value: formatCount(duration?.sample_count) },
          { label: "Excluded records", value: formatCount(duration?.excluded_count) },
        ]} />
        <p>Only corresponding submission/review cycles qualify. Missing timestamps: {formatCount(duration?.missing_timestamp_count)}; invalid chronology: {formatCount(duration?.invalid_chronology_count)}; unrelated records: {formatCount(duration?.unrelated_record_count)}. Unassignable missing decision times across all dates: {formatCount(duration?.missing_decision_timestamp_count)}.</p>
        <p>Overall SLA compliance uses classified outcomes across all recorded reviews; unknowns are excluded. It is not filtered by global dates. Recovery is the share of applications with recorded rejection that submitted again strictly after a rejection, counted once per application as of now; global dates do not filter it.</p>
        <p>Weekly throughput includes resubmissions and approved/rejected review decisions, with clipped partial Manila weeks.</p>
        <p>Rejected decisions: {formatCount(rejected?.rejected_decisions)}; distinct applications: {formatCount(rejected?.distinct_applications)}; decisions without section feedback: {formatCount(rejected?.decisions_without_section_feedback)}. Sections overlap; shares need not total 100%.</p>

        </div>}
      />
    </>
  );
}
