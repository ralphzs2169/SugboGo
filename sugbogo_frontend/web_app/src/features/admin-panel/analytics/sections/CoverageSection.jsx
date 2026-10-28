import { useState } from "react";
import { useCoverageAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsScopeFilters from "../components/AnalyticsScopeFilters";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDataNotice from "../components/AnalyticsDataNotice";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatPercentage } from "../utils/presentation";

/** Shows pooled coverage denominators and current taxonomy breakdowns without losing SQL eligibility during outages. */
export default function CoverageSection({ period }) {
  const [scope, setScope] = useState({});
  const [group, setGroup] = useState("categories");
  const query = useCoverageAnalytics({ ...period, ...scope });
  const state = useAnalyticsSectionState(query, "coverage", "business coverage");
  const data = query.data;
  return (
    <AnalyticsSection title="Business Coverage" description="Recorded visits across currently active businesses. Eligibility uses current classification and status." {...state}
      controls={<AnalyticsScopeFilters scope="Coverage" value={scope} onChange={setScope} />}
      partialNotice={data?.meta?.is_partial ? "Recorded coverage is unverified. A zero recorded-visit count does not establish zero real-world exposure." : null}
      footer={<AnalyticsReportContext meta={data?.meta} />}
    >
      {/* SQL-backed denominators remain visible when visibility is unavailable */}
      <AnalyticsSummary items={[["eligible_businesses", "Eligible businesses", formatCount], ["visited_businesses", "Businesses with recorded visits", formatCount], ["zero_recorded_visit_businesses", "Zero recorded visits", formatCount], ["coverage_percentage", "Coverage", formatPercentage]].map(([key, label, format]) => ({ label, value: format(data?.overall?.[key]) }))} />
      {data?.sources?.visibility?.availability === "unavailable" && <div className="mb-4"><AnalyticsDataNotice kind="unavailable">Visit observations are unavailable. Current eligible-business counts remain available.</AnalyticsDataNotice></div>}
      {/* Exact breakdowns expose both numerator and denominator */}
      <div className="mb-3"><AnalyticsMetricSelector label="Coverage breakdown" value={group} onChange={setGroup} options={[{ value: "categories", label: "By category" }, { value: "clusters", label: "By cluster" }]} /></div>
      <AnalyticsExactTable caption={`Business coverage by ${group}`} rows={data?.[group]} columns={[
        { key: "name", label: group === "categories" ? "Category" : "Cluster" },
        ...[["eligible_businesses", "Eligible"], ["visited_businesses", "Recorded visited businesses"], ["zero_recorded_visit_businesses", "Zero recorded visits"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) })),
        { key: "coverage_percentage", label: "Coverage", render: (row) => formatPercentage(row.coverage_percentage) },
      ]} emptyMessage="No businesses match the selected scope." />
    </AnalyticsSection>
  );
}
