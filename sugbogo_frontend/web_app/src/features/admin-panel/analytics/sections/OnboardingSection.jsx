import { useOnboardingAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsMetricGrid from "../components/AnalyticsMetricGrid";
import AnalyticsMetricCard from "../components/AnalyticsMetricCard";
import AnalyticsTimeSeries, { AnalyticsSeriesValues } from "../components/AnalyticsTimeSeries";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsReportContext, { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatHours, formatPercentage } from "../utils/presentation";

const LINES = [{ key: "submissions", label: "Submissions" }, { key: "completed_reviews", label: "Completed reviews" }];

/** Shows current SLA workload alongside selected-period throughput, linked turnaround and rejection decisions. */
export default function OnboardingSection({ period }) {
  const query = useOnboardingAnalytics(period);
  const state = useAnalyticsSectionState(query, "onboarding", "merchant onboarding");
  const data = query.data;
  const aging = data?.pending_aging;
  const duration = data?.review_turnaround;
  const rejected = data?.rejection_insights;
  const sections = [...(rejected?.sections ?? [])].sort((left, right) => right.rejection_decisions - left.rejection_decisions);
  return (
    <AnalyticsSection title="Merchant Onboarding" description="Current application workload, selected-period processing, and common rejection sections." {...state}
      action={<AnalyticsDrilldown to="/admin-panel/businesses/applications">View applications</AnalyticsDrilldown>}
      footer={<AnalyticsReportContext meta={data?.processing_meta}><p>Backlog is a current snapshot; SLA aging counts weekdays and excludes the submission day, without a holiday calendar.</p></AnalyticsReportContext>}
    >
      {/* Current backlog uses existing business-day SLA bands */}
      <AnalyticsMetricGrid>
        {[
          ["Pending applications", data?.legacy_statistics?.pending_review],
          ["On time", aging?.on_time],
          ["Approaching SLA", aging?.approaching],
          ["Overdue", aging?.overdue],
        ].map(([label, value]) => <AnalyticsMetricCard key={label} label={label} value={value} formatValue={formatCount} measurementType="current_snapshot" />)}
      </AnalyticsMetricGrid>
      <p className="mt-3 text-xs text-text-secondary">Approaching: {formatCount(data?.aging_meta?.approaching_business_days)} business days. Overdue: {formatCount(data?.aging_meta?.overdue_business_days)} business days. Unknown age: {formatCount(aging?.unknown_age)}.</p>

      {/* Incoming and completed work share one weekly time axis */}
      <div className="mt-6 border-t border-stroke pt-5">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Submissions and completed reviews · selected period</h3>
        <div className="h-64 sm:h-72"><AnalyticsTimeSeries rows={data?.weekly_activity} lines={LINES} /></div>
        <p className="mt-2 text-xs text-text-secondary">Weekly Manila buckets include resubmissions and recorded approved/rejected review decisions. Partial weeks are clipped to the period.</p>
        <AnalyticsSeriesValues title="Onboarding workload" rows={data?.weekly_activity} lines={LINES} />
      </div>

      {/* Linked submission-to-review samples and explicitly scoped overall rates */}
      <div className="mt-6 border-t border-stroke pt-5">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Review turnaround · selected decision period</h3>
        <AnalyticsSummary items={[
          { label: "Median review turnaround", value: formatHours(duration?.median_hours) },
          { label: "Mean review turnaround", value: formatHours(duration?.mean_hours) },
          { label: "Valid samples", value: formatCount(duration?.sample_count) },
          { label: "Excluded records", value: formatCount(duration?.excluded_count) },
        ]} />
        <p className="mb-4 text-xs text-text-secondary">Only corresponding submission/review cycles qualify. Missing timestamps: {formatCount(duration?.missing_timestamp_count)}; invalid chronology: {formatCount(duration?.invalid_chronology_count)}; unrelated records: {formatCount(duration?.unrelated_record_count)}. Unassignable missing decision times across all dates: {formatCount(duration?.missing_decision_timestamp_count)}.</p>
        <AnalyticsSummary items={[
          { label: "Overall SLA compliance · all recorded reviews", value: formatPercentage(data?.legacy_statistics?.sla_compliance_rate), context: "Classified outcomes only; unknowns excluded. Global dates do not filter this rate." },
          { label: "Post-rejection resubmission recovery · as of now", value: formatPercentage(data?.legacy_statistics?.resubmission_rate), context: "Rejected applications that submitted again strictly after a rejection. Global dates do not filter this rate." },
        ]} />
      </div>

      {/* Section counts overlap and are decision counts, not feedback-row counts */}
      <h3 className="mb-2 text-sm font-semibold text-text-primary">Rejection insights · selected decision period</h3>
      <p className="mb-3 text-sm text-text-secondary">{formatCount(rejected?.rejected_decisions)} rejected decisions across {formatCount(rejected?.distinct_applications)} applications. Sections overlap; shares need not total 100%. Decisions without section feedback: {formatCount(rejected?.decisions_without_section_feedback)}.</p>
      <AnalyticsExactTable caption="Rejected application sections" rows={sections} columns={[
        { key: "label", label: "Section" },
        { key: "rejection_decisions", label: "Rejection decisions", render: (row) => formatCount(row.rejection_decisions) },
        { key: "distinct_applications", label: "Distinct applications", render: (row) => formatCount(row.distinct_applications) },
        { key: "decision_share_percentage", label: "Share of decisions", render: (row) => formatPercentage(row.decision_share_percentage) },
      ]} emptyMessage="No section feedback is available for rejected decisions in this period." />
    </AnalyticsSection>
  );
}
