import { useSpecialtySupportAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsMetricGrid from "../components/AnalyticsMetricGrid";
import AnalyticsMetricCard from "../components/AnalyticsMetricCard";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsReportContext from "../components/AnalyticsReportContext";
import { formatCount } from "../utils/presentation";

/** Uses backend global distinct totals and ranks current valid specialty evidence without summing people. */
export default function SpecialtySupportSection() {
  const query = useSpecialtySupportAnalytics();
  const state = useAnalyticsSectionState(query, "support", "specialty support");
  const data = query.data;
  return (
    <AnalyticsSection title="Specialty Support" description="Current valid endorsement records on active business–specialty assignments. Global dates do not filter this snapshot." {...state}
      footer={<AnalyticsReportContext asOf={data?.as_of}><p>Each specialty endorsement is a separate record. One person can support several specialties; tag-level unique counts must not be summed into a population count.</p></AnalyticsReportContext>}
    >
      {/* Global distinct populations come directly from the backend summary */}
      <AnalyticsMetricGrid>{[["valid_vouches", "Valid endorsements"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"], ["supported_specialties", "Supported specialties"]].map(([key, label]) => <AnalyticsMetricCard key={key} label={label} value={data?.summary?.[key]} formatValue={formatCount} measurementType="current_snapshot" />)}</AnalyticsMetricGrid>
      <div className="mt-5"><AnalyticsExactTable caption="Top-supported specialties" rows={data?.top_supported_specialties} columns={[{ key: "name", label: "Specialty" }, ...[["valid_vouches", "Valid endorsements"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) }))]} emptyMessage="No specialties currently have valid support." /></div>
    </AnalyticsSection>
  );
}
