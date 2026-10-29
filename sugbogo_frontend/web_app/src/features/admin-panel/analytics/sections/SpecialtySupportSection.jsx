import { useSpecialtySupportAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsRanking from "../components/AnalyticsRanking";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount } from "../utils/presentation";

/** Leads with global distinct populations and a visual ranking of current specialty evidence. */
export default function SpecialtySupportSection() {
  const query = useSpecialtySupportAnalytics();
  const state = useAnalyticsSectionState(query, "support", "specialty support");
  const data = query.data;
  const rows = data?.top_supported_specialties ?? [];
  return (
    <AnalyticsSection title="Specialty Support" description="Current specialty evidence and leading endorsements." {...state}
      footer={<AnalyticsReportContext asOf={data?.as_of}><p>Each valid specialty endorsement is a separate record on an active assignment. Global dates do not filter this snapshot. One person can support several specialties; tag-level unique counts must not be summed into a population count.</p></AnalyticsReportContext>}
    >
      {/* Backend global totals stay independent of tag-level supporter counts */}
      <AnalyticsSummary compact items={[["valid_vouches", "Valid endorsements"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"], ["supported_specialties", "Supported specialties"]].map(([key, label]) => ({ label, value: formatCount(data?.summary?.[key]) }))} />
      <div className="mt-5"><AnalyticsRanking label="Top-supported specialties" rows={rows.slice(0, 5).map((row) => ({ id: row.specialty_id, name: row.name, value: row.valid_vouches }))} emptyMessage="No specialties currently have valid support." /></div>
      {/* Full exact populations are available without dominating the ranking */}
      <AnalyticsDisclosure label="View specialty breakdown">
        <AnalyticsExactTable caption="Top-supported specialties" rows={rows} columns={[{ key: "name", label: "Specialty" }, ...[["valid_vouches", "Valid endorsements"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) }))]} />
      </AnalyticsDisclosure>
    </AnalyticsSection>
  );
}
