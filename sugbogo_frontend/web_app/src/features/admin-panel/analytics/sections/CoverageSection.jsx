import { useId, useState } from "react";
import { Filter } from "lucide-react";
import SortMenu from "../../components/data-table/SortMenu";
import TableTabs from "../../components/data-table/TableTabs";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useCoverageAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsScopeFilters from "../components/AnalyticsScopeFilters";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDataNotice from "../components/AnalyticsDataNotice";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsReportExplanation from "../components/AnalyticsReportExplanation";
import AnalyticsReliability from "../components/AnalyticsReliability";
import { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount, formatPercentage } from "../utils/presentation";

const headlinePercentage = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });

/** Shows pooled coverage denominators and current taxonomy breakdowns without losing SQL eligibility during outages. */
export default function CoverageSection({ period }) {
  const [scope, setScope] = useWorkspaceSelection("coverage.scope", {});
  const [group, setGroup] = useWorkspaceSelection("coverage.group", "categories");
  const [drawer, setDrawer] = useState(null);
  const dimensionId = useId();
  const activeFilters = [scope.cluster, scope.category].filter(Boolean).length;
  const query = useCoverageAnalytics({ ...period, ...scope });
  const state = useAnalyticsSectionState(query, "coverage", "business coverage");
  const data = query.data;
  const visibilityUnavailable = data?.sources?.visibility?.availability === "unavailable";
  const known = (data?.[group] ?? []).filter((row) => !visibilityUnavailable && row.coverage_percentage != null && row.eligible_businesses > 0);
  const ascending = [...known].sort((left, right) => left.coverage_percentage - right.coverage_percentage || left.id - right.id);
  const preview = ascending.slice(0, 5);
  const overall = data?.overall;
  return (
    <>
      <AnalyticsSection title="Business Coverage" {...state}
        controls={<SortMenu ariaLabel="Coverage filters" triggerLabel={`Filters${activeFilters ? ` (${activeFilters})` : ""}`} icon={Filter}
          value="filters" options={[]} customOnly
          customContent={() => <AnalyticsScopeFilters scope="Coverage" clusterLabel="Cluster" categoryLabel="Category" value={scope} onChange={setScope} />} />}
        isEmpty={overall?.eligible_businesses === 0}
        emptyMessage="No eligible active businesses match the selected scope."
        footer={<AnalyticsReportFooter title="Business Coverage" meta={data?.meta} coverageLabel="Coverage unverified" hasData={Boolean(data)} onAbout={() => setDrawer("about")} onData={() => setDrawer("data")} />}
      >
        {/* SQL-backed denominators remain visible when visibility is unavailable */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-text-primary">{overall?.coverage_percentage == null ? formatPercentage(null) : `${headlinePercentage.format(overall.coverage_percentage)}%`} <span className="sr-only">coverage</span></p>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{overall?.visited_businesses == null
            ? `${formatCount(overall?.eligible_businesses)} eligible businesses · recorded profile visits unavailable`
            : `${formatCount(overall.visited_businesses)} of ${formatCount(overall.eligible_businesses)} eligible businesses received recorded profile visits`}</p>
        </div>
        {visibilityUnavailable && <div className="mb-4"><AnalyticsDataNotice kind="unavailable">Visit observations are unavailable. Current eligible-business counts remain available.</AnalyticsDataNotice></div>}
        {/* One bounded ranking compares the same classification level on a common percentage scale. */}
        <div className="mb-3 max-w-full overflow-x-auto pb-1">
          <TableTabs size="sm" ariaLabel="Coverage dimension" tabListId={dimensionId}
            tabs={[{ id: "categories", label: "Category" }, { id: "clusters", label: "Cluster" }]}
            activeTab={group} onTabChange={setGroup} />
        </div>
        <div role="tabpanel" id={`${dimensionId}-panel-${group}`} aria-labelledby={`${dimensionId}-${group}`} tabIndex={0} className="min-w-0 rounded focus-visible:outline-2 focus-visible:outline-info">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Coverage by {group === "categories" ? "category" : "cluster"}</h3>
          <ol aria-label={`Ranked coverage by ${group}`} className="space-y-3">
            {preview.map((row) => <li key={row.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words text-text-primary">{row.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-text-primary">{formatPercentage(row.coverage_percentage)}</span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${row.coverage_percentage}%` }} />
              </div>
            </li>)}
          </ol>
          {preview.length === 0 && <p className="text-xs text-text-secondary">{visibilityUnavailable ? "Classification coverage is unavailable." : "No classified coverage is available for this scope."}</p>}
          {overall?.zero_recorded_visit_businesses != null && <p className="mt-3 text-xs text-text-secondary">{formatCount(overall.zero_recorded_visit_businesses)} {overall.zero_recorded_visit_businesses === 1 ? "business had" : "businesses had"} no recorded profile visits</p>}
        </div>
      </AnalyticsSection>
      <AnalyticsDetailDrawer mode={drawer} onClose={() => setDrawer(null)} title="Business Coverage" report={data} interval="selected period" series={[]} showComparison={false}
        aboutContent={<pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ overall, sources: data?.sources }, null, 2)}</pre>}
        dataContent={<div className="space-y-5">
          <AnalyticsSummary items={[["eligible_businesses", "Eligible businesses"], ["visited_businesses", "Covered businesses"], ["zero_recorded_visit_businesses", "Businesses with no recorded visits"]].map(([key, label]) => ({ label, value: formatCount(overall?.[key]) }))} />
          {["clusters", "categories"].map((classification) => <div key={classification}>
            <h3 className="mb-2 font-semibold text-text-primary">{classification === "clusters" ? "All clusters" : "All categories"} in selected scope</h3>
            <AnalyticsExactTable caption={`Business coverage by ${classification}`} rows={data?.[classification]} columns={[
              { key: "name", label: classification === "categories" ? "Category" : "Cluster" },
              ...[["eligible_businesses", "Eligible businesses"], ["visited_businesses", "Covered businesses"], ["zero_recorded_visit_businesses", "No recorded visits"]].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) })),
              { key: "coverage_percentage", label: "Coverage", render: (row) => formatPercentage(row.coverage_percentage) },
            ]} emptyMessage="No classifications match the selected scope." />
          </div>)}
          <AnalyticsReportExplanation title="Business Coverage" report={data} />
          <AnalyticsReliability meta={data?.meta} />
        </div>}
      />
    </>
  );
}
