import { useState } from "react";
import { useSpecialtySupportAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsRanking from "../components/AnalyticsRanking";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsReportExplanation from "../components/AnalyticsReportExplanation";
import AnalyticsReliability from "../components/AnalyticsReliability";
import { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatTimestamp } from "../utils/presentation";

/** Leads with global distinct populations and a visual ranking of current specialty evidence. */
export default function SpecialtySupportSection() {
  const [mode, setMode] = useState(null);
  const query = useSpecialtySupportAnalytics();
  const state = useAnalyticsSectionState(query, "support", "specialty support");
  const data = query.data;
  const rows = data?.top_supported_specialties ?? [];
  const allRows = data?.specialties ?? rows;
  return (
    <>
      <AnalyticsSection title="Specialty Support" description="Current specialty evidence and leading endorsements." {...state}
        footer={<AnalyticsReportFooter title="Specialty Support" meta={data?.meta} hasData={Boolean(data)} onAbout={() => setMode("about")} onData={() => setMode("data")} />}
      >
        {/* Backend global totals stay independent of tag-level supporter counts */}
        <AnalyticsSummary compact items={[["valid_vouches", "Valid endorsements"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"], ["supported_specialties", "Supported specialties"]].map(([key, label]) => ({ label, value: formatCount(data?.summary?.[key]) }))} />
        <div className="mt-5"><AnalyticsRanking label="Top-supported specialties" rows={rows.slice(0, 5).map((row) => ({ id: row.specialty_id, name: row.name, value: row.valid_vouches }))} emptyMessage="No specialties currently have valid support." /></div>
      </AnalyticsSection>
      {/* The complete supplied breakdown and methodology share the existing drawer. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Specialty Support"
        report={data} interval="current snapshot" series={[]} showComparison={false}
        periodContent={<div className="text-sm text-text-secondary"><p>Current snapshot · {formatTimestamp(data?.as_of)} PHT</p><p className="mt-1">Selected dates do not filter this report.</p></div>}
        aboutContent={<p>{data?.definition}</p>}
        dataContent={<div className="space-y-5">
          <AnalyticsExactTable caption="Complete specialty support breakdown" rows={allRows} columns={[
            { key: "name", label: "Specialty" },
            ...[["valid_vouches", "Valid endorsements"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) })),
          ]} />
          <AnalyticsReportExplanation title="Specialty Support" report={data} />
          <AnalyticsReliability meta={data?.meta} />
        </div>}
      />
    </>
  );
}
