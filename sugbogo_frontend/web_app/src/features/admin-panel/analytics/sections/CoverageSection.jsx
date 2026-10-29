import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useCoverageAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsScopeFilters from "../components/AnalyticsScopeFilters";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDataNotice from "../components/AnalyticsDataNotice";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatPercentage } from "../utils/presentation";

/** Shows pooled coverage denominators and current taxonomy breakdowns without losing SQL eligibility during outages. */
export default function CoverageSection({ period }) {
  const [scope, setScope] = useWorkspaceSelection("coverage.scope", {});
  const [group, setGroup] = useWorkspaceSelection("coverage.group", "categories");
  const query = useCoverageAnalytics({ ...period, ...scope });
  const state = useAnalyticsSectionState(query, "coverage", "business coverage");
  const data = query.data;
  const known = (data?.[group] ?? []).filter((row) => row.coverage_percentage != null && row.eligible_businesses > 0);
  const ascending = [...known].sort((left, right) => left.coverage_percentage - right.coverage_percentage || left.id - right.id);
  const highlights = known.length > 3
    ? [{ label: "Highest coverage", rows: [...ascending].reverse().slice(0, 2) }, { label: "Lowest coverage", rows: ascending.slice(0, 3) }]
    : [{ label: "Coverage highlights", rows: ascending }];
  return (
    <AnalyticsSection title="Business Coverage" description="Recorded visits across eligible active businesses." {...state}
      controls={<AnalyticsScopeFilters scope="Coverage" value={scope} onChange={setScope} />}
      partialNotice={data?.meta?.is_partial ? "Recorded coverage is unverified. A zero recorded-visit count does not establish zero real-world exposure." : null}
      footer={<AnalyticsReportContext meta={data?.meta} />}
    >
      {/* SQL-backed denominators remain visible when visibility is unavailable */}
      <div className="mb-4">
        <p className="text-3xl font-bold tracking-tight text-text-primary">{formatPercentage(data?.overall?.coverage_percentage)} <span className="text-xs font-normal text-text-secondary">coverage</span></p>
        <p className="mt-1 text-sm text-text-secondary">{formatCount(data?.overall?.visited_businesses)} of {formatCount(data?.overall?.eligible_businesses)} eligible businesses received recorded visits</p>
        <p className="mt-1 text-xs text-text-secondary">{formatCount(data?.overall?.zero_recorded_visit_businesses)} with no recorded visits</p>
      </div>
      {data?.sources?.visibility?.availability === "unavailable" && <div className="mb-4"><AnalyticsDataNotice kind="unavailable">Visit observations are unavailable. Current eligible-business counts remain available.</AnalyticsDataNotice></div>}
      {/* Highlights lead; the complete denominator-preserving table is disclosed on demand */}
      <div className="mb-3 grid gap-4 sm:grid-cols-2">
        {highlights.map((highlight) => <div key={highlight.label}><h3 className="mb-2 text-xs font-medium text-text-secondary">{highlight.label}</h3><dl className="space-y-2 text-xs">{highlight.rows.map((row) => <div key={row.id} className="flex justify-between gap-3"><dt className="min-w-0 truncate text-text-primary" title={row.name}>{row.name}</dt><dd className="shrink-0 font-semibold text-text-primary">{formatPercentage(row.coverage_percentage)}</dd></div>)}</dl>{!highlight.rows.length && <p className="text-xs text-text-secondary">No classified coverage for this scope.</p>}</div>)}
      </div>
      <AnalyticsDisclosure label="View full coverage">
        <AnalyticsSummary items={[["eligible_businesses", "Eligible businesses", formatCount], ["visited_businesses", "Businesses with recorded visits", formatCount], ["zero_recorded_visit_businesses", "Zero recorded visits", formatCount]].map(([key, label, format]) => ({ label, value: format(data?.overall?.[key]) }))} />
        <AnalyticsMetricSelector label="Coverage breakdown" value={group} onChange={setGroup} options={[{ value: "categories", label: "By category" }, { value: "clusters", label: "By cluster" }]} />
        <AnalyticsExactTable caption={`Business coverage by ${group}`} rows={data?.[group]} columns={[
          { key: "name", label: group === "categories" ? "Category" : "Cluster" },
          ...[["eligible_businesses", "Eligible"], ["visited_businesses", "Recorded visited businesses"], ["zero_recorded_visit_businesses", "Zero recorded visits"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) })),
          { key: "coverage_percentage", label: "Coverage", render: (row) => formatPercentage(row.coverage_percentage) },
        ]} emptyMessage="No businesses match the selected scope." />
      </AnalyticsDisclosure>
    </AnalyticsSection>
  );
}
