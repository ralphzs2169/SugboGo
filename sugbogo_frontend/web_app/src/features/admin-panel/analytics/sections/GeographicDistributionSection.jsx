import { useCallback, useState } from "react";
import { useDiscoveryHeatmap } from "../hooks/useAnalyticsReports";
import useAnalyticsTaxonomy from "../hooks/useAnalyticsTaxonomy";
import { geographicRanges } from "../utils/geographicPresentation";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsScopeFilters from "../components/AnalyticsScopeFilters";
import GeographicDistributionMap from "../components/GeographicDistributionMap";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsReportExplanation from "../components/AnalyticsReportExplanation";
import AnalyticsReliability from "../components/AnalyticsReliability";
import { formatCount } from "../utils/presentation";

const MODES = [
  { value: "eligible_businesses", label: "Business distribution" },
  { value: "profile_visits", label: "Recorded profile visits" },
];
const NO_CELLS = [];
const STATES = { no_businesses: "No eligible businesses", visibility_unavailable: "Visits unavailable", zero_recorded_visits: "Zero recorded visits", recorded_visits: "Recorded visits" };

/** Shows current inventory and period visits over the same approved business-location grid. */
function GeographicReport({ period }) {
  const [scope, setScope] = useWorkspaceSelection("geography.scope", {});
  const [metric, setMetric] = useWorkspaceSelection("geography.metric", "eligible_businesses");
  const [selected, setSelected] = useState("");
  const [hovered, setHovered] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const selectCell = useCallback((id) => setSelected(id), []);
  const query = useDiscoveryHeatmap({ ...period, ...scope });
  const state = useAnalyticsSectionState(query, "geography", "geographic distribution");
  const data = query.data;
  const cells = data?.cells ?? NO_CELLS;
  const current = cells.find((cell) => cell.id === selected);
  const hoveredCell = cells.find((cell) => cell.id === hovered?.id);
  const ranges = geographicRanges(cells, metric);
  const { clusters, categories } = useAnalyticsTaxonomy();
  const clusterName = clusters.data?.find((row) => String(row.id) === String(scope.cluster))?.name;
  const categoryName = categories.data?.find((row) => String(row.id) === String(scope.category))?.name;
  const scopeText = `${clusterName ?? (scope.cluster ? "Selected cluster" : "All clusters")} · ${categoryName ?? (scope.category ? "Selected category" : "All categories")}`;
  const visibilityUnavailable = data?.sources?.visibility?.availability === "unavailable";
  const exclusions = Object.entries(data?.reconciliation?.excluded_by_reason ?? {}).map(([reason, values]) => ({ reason, ...values }));
  function changeScope(next) {
    setSelected("");
    setHovered(null);
    setScope(next);
  }
  return (
    <>
      <AnalyticsSection title="Geographic Distribution" description={metric === "eligible_businesses" ? "Current eligible businesses by area across Cebu City." : "Selected-period profile visits at current business locations across Cebu City."} {...state}
        controls={<>
          <AnalyticsMetricSelector label="Metric" options={MODES} value={metric} onChange={setMetric} />
          <AnalyticsScopeFilters scope="Geographic" clusterLabel="Cluster" categoryLabel="Category" value={scope} onChange={changeScope} />
        </>}
        unavailable={data?.cells === null}
        unavailableMessage="The approved geographic grid is unavailable. This does not mean there are no businesses or visits."
        footer={<AnalyticsReportFooter title="Geographic Distribution" meta={data?.meta} coverageLabel="Visit recording coverage unverified" coverageDescription="Business inventory reflects current records. Recorded profile activity may be incomplete; complete event recording has not been verified." hasData={Array.isArray(data?.cells)} hasDetails={Boolean(data)} onAbout={() => setDrawer("about")} onData={() => setDrawer("data")} />}
      >
        {/* Backend geometries determine the extent, cell boundaries and intensity population. */}
        {visibilityUnavailable && <p role="status" className="mb-3 text-sm text-text-secondary">Recorded visits are unavailable; current business counts remain available.</p>}
        <GeographicDistributionMap cells={cells} metric={metric} selected={selected} onSelect={selectCell} onHover={setHovered} hovered={hovered} hoveredCell={hoveredCell} scopeText={scopeText} />
        {/* Metric-specific ranges share the same classes as the map intensity. */}
        <div aria-label="Geographic intensity legend" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">{metric === "eligible_businesses" ? "Businesses per area" : "Recorded profile visits per area"}</span>
          {metric === "profile_visits" && visibilityUnavailable ? <span>Visit intensity unavailable</span> : ranges.length === 0 ? <span>No positive counts in this scope</span> : ranges.map((range) => (
            <span key={range.lower} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-5 rounded-sm bg-primary" style={{ opacity: range.opacity }} />{range.label}</span>
          ))}
          {metric === "profile_visits" && <><span>Zero visits: unfilled</span><span>Unavailable: gray</span></>}
        </div>
        <p className="mt-2 text-xs text-text-secondary">Areas without eligible businesses are hidden. This shows business locations, not foot traffic.</p>
        {/* Selection stays separate from hover and emphasizes the active measure. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-3">
          <div role="status">
            <h3 className="text-sm font-medium text-text-primary">Selected area</h3>
            {current ? <>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{formatCount(current[metric])} {metric === "eligible_businesses" ? "businesses" : "recorded profile visits"}</p>
              <p className="mt-1 text-xs text-text-secondary">{metric === "eligible_businesses" ? `${formatCount(current.profile_visits)} recorded profile visits · selected period` : `${formatCount(current.eligible_businesses)} businesses · current inventory`}</p>
              <p className="mt-1 text-xs text-text-secondary">{scopeText}</p>
            </> : <p className="mt-1 text-sm text-text-secondary">Click an area on the map to inspect its business counts and recorded visits.</p>}
          </div>
          {current && <button type="button" onClick={() => { selectCell(""); setHovered(null); }} className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">Clear selection</button>}
        </div>
      </AnalyticsSection>
      {/* Exact values, excluded locations and attribution remain in the shared drawer. */}
      <AnalyticsDetailDrawer mode={drawer} onClose={() => setDrawer(null)} title="Geographic Distribution" report={data} interval="selected period" series={[]} showComparison={false}
        aboutContent={<pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ grid: data?.definition, scope: data?.scope, attribution: data?.attribution, sources: data?.sources, reconciliation: data?.reconciliation }, null, 2)}</pre>}
        dataContent={<div className="space-y-5">
          <AnalyticsExactTable caption="All geographic cells in selected taxonomy scope" rows={cells} columns={[
            { key: "inspect", label: "Area", render: (row) => row.eligible_businesses > 0 ? <button type="button" onClick={() => { selectCell(row.id); setHovered(null); setDrawer(null); }} className="cursor-pointer rounded px-2 py-1 text-sm font-medium text-text-primary underline focus-visible:outline-2 focus-visible:outline-info">Inspect area</button> : "No eligible businesses" },
            { key: "id", label: "Grid cell" },
            { key: "eligible_businesses", label: "Current businesses", render: (row) => formatCount(row.eligible_businesses) },
            { key: "profile_visits", label: "Recorded profile visits", render: (row) => formatCount(row.profile_visits) },
            { key: "state", label: "Observation status", render: (row) => STATES[row.state] ?? "Unknown" },
          ]} />
          <AnalyticsExactTable caption="Locations excluded from the geographic grid" rows={exclusions} columns={[
            { key: "reason", label: "Exclusion" },
            { key: "businesses", label: "Businesses", render: (row) => formatCount(row.businesses) },
            { key: "profile_visits", label: "Recorded visits", render: (row) => formatCount(row.profile_visits) },
          ]} />
          <AnalyticsReportExplanation title="Geographic Distribution" report={data} />
          <AnalyticsReliability meta={data?.meta} />
        </div>}
      />
    </>
  );
}

/** Resets area selection when the global reporting period changes without altering query contracts. */
export default function GeographicDistributionSection({ period }) {
  return <GeographicReport key={JSON.stringify(period)} period={period} />;
}
