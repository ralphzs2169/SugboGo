import { useOnboardingAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsMetricGrid from "../components/AnalyticsMetricGrid";
import AnalyticsMetricCard from "../components/AnalyticsMetricCard";
import AnalyticsTimeSeries, { AnalyticsSeriesValues } from "../components/AnalyticsTimeSeries";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsRanking from "../components/AnalyticsRanking";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsReportContext, { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatHours, formatPercentage } from "../utils/presentation";

const LINES = [{ key: "submissions", label: "Submissions" }, { key: "completed_reviews", label: "Completed reviews" }];

/** Leads with actionable backlog and processing health; methodology remains progressively disclosed. */
export default function OnboardingSection({ period }) {
  const query = useOnboardingAnalytics(period);
  const state = useAnalyticsSectionState(query, "onboarding", "merchant onboarding");
  const data = query.data;
  const aging = data?.pending_aging;
  const duration = data?.review_turnaround;
  const rejected = data?.rejection_insights;
  const sections = [...(rejected?.sections ?? [])].sort((left, right) => right.rejection_decisions - left.rejection_decisions);
  return (
    <AnalyticsSection title="Merchant Onboarding" description="Workload, review speed, and application recovery." {...state}
      action={<AnalyticsDrilldown to="/admin-panel/businesses/applications">View applications</AnalyticsDrilldown>}
      footer={<AnalyticsReportContext meta={data?.processing_meta}>
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
      </AnalyticsReportContext>}
    >
      {/* Operational priorities reuse the existing Admin metric card */}
      <AnalyticsMetricGrid>
        <AnalyticsMetricCard compact label="Pending applications" value={data?.legacy_statistics?.pending_review} formatValue={formatCount} measurementType="current_snapshot" />
        <AnalyticsMetricCard compact label="Overdue" value={aging?.overdue} formatValue={formatCount} measurementType="current_snapshot" />
        <AnalyticsMetricCard compact label="SLA compliance" value={data?.legacy_statistics?.sla_compliance_rate} formatValue={formatPercentage} measurementLabel="All recorded reviews" details="Classified outcomes only; unknowns excluded. Global dates do not filter this rate." />
        <AnalyticsMetricCard compact label="Median review turnaround" value={duration?.median_hours} formatValue={formatHours} measurementLabel="Selected decision period" details={`${formatCount(duration?.sample_count)} valid linked submission/review samples; ${formatCount(duration?.excluded_count)} excluded records.`} />
      </AnalyticsMetricGrid>

      {/* Throughput and rejection ranking share the decision workspace */}
      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Submissions vs reviews</h3>
          <div className="h-56 min-w-0"><AnalyticsTimeSeries rows={data?.weekly_activity} lines={LINES} /></div>
          <AnalyticsSeriesValues title="Onboarding workload" rows={data?.weekly_activity} lines={LINES} />
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Top rejection sections</h3>
          <AnalyticsRanking label="Rejected application sections" rows={sections.map((row) => ({ id: row.section, name: row.label, value: row.rejection_decisions }))} />
          <p className="mt-3 text-xs text-text-secondary">Rejection decisions · sections can overlap.</p>
          <AnalyticsDisclosure label="Full rejection breakdown">
            <AnalyticsExactTable caption="Rejected application sections" rows={sections} columns={[
              { key: "label", label: "Section" }, { key: "rejection_decisions", label: "Rejection decisions", render: (row) => formatCount(row.rejection_decisions) },
              { key: "distinct_applications", label: "Distinct applications", render: (row) => formatCount(row.distinct_applications) },
              { key: "decision_share_percentage", label: "Share of decisions", render: (row) => formatPercentage(row.decision_share_percentage) },
            ]} />
          </AnalyticsDisclosure>
        </div>
      </div>
      {/* Recovery remains an explicit, concise operational insight */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-stroke pt-3">
        <p className="font-semibold text-text-primary">{formatPercentage(data?.legacy_statistics?.resubmission_rate)} post-rejection recovery</p>
        <p className="text-xs text-text-secondary">Applications that submitted again after rejection · as of now</p>
      </div>
    </AnalyticsSection>
  );
}
