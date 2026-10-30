import { useCallback, useState } from "react";
import { useDiscoveryHeatmap } from "../hooks/useAnalyticsReports";
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
  const current = cells.find((cell) => cell.id === (hovered ?? selected));
  const maximum = Math.max(0, ...cells.map((cell) => cell[metric] ?? 0));
  const visibilityUnavailable = data?.sources?.visibility?.availability === "unavailable";
  const exclusions = Object.entries(data?.reconciliation?.excluded_by_reason ?? {}).map(([reason, values]) => ({ reason, ...values }));
  function changeScope(next) {
    setSelected("");
    setHovered(null);
    setScope(next);
  }
  return (
    <>
      <AnalyticsSection title="Geographic Distribution" description="Business inventory and recorded profile attention across Cebu City." {...state}
        controls={<>
          <AnalyticsMetricSelector label="Geographic metric" options={MODES} value={metric} onChange={setMetric} />
          <AnalyticsScopeFilters scope="Geographic" value={scope} onChange={changeScope} />
        </>}
        unavailable={data?.cells === null}
        unavailableMessage="The approved geographic grid is unavailable. This does not mean there are no businesses or visits."
        partialNotice={data?.meta?.is_partial ? "Inventory uses current business locations. Visit recording is incomplete or unverified; this is not physical visitor activity." : null}
        footer={<AnalyticsReportFooter title="Geographic Distribution" meta={data?.meta} hasData={Array.isArray(data?.cells)} hasDetails={Boolean(data)} onAbout={() => setDrawer("about")} onData={() => setDrawer("data")} />}
      >
        {/* Backend geometries determine the extent, cell boundaries and intensity population. */}
        <p className="mb-3 text-xs text-text-secondary">{metric === "eligible_businesses" ? "Current eligible business inventory" : "Selected-period recorded profile visits at current business locations"}</p>
        {visibilityUnavailable && <p role="status" className="mb-3 text-sm text-text-secondary">Recorded visits are unavailable; current business counts remain available.</p>}
        <GeographicDistributionMap cells={cells} metric={metric} selected={selected} onSelect={selectCell} onHover={setHovered} />
        {/* Count legend distinguishes empty cells, measured zero and unavailable observations. */}
        <div aria-label="Geographic intensity legend" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
          {metric === "profile_visits" && visibilityUnavailable ? <span>Visit intensity unavailable</span> : maximum === 0 ? <span>No positive counts in this scope</span> : <span className="inline-flex items-center gap-2">Lower <span aria-hidden="true" className="inline-flex gap-0.5">{[0.15, 0.4, 0.85].map((opacity) => <span key={opacity} className="h-3 w-6 bg-primary" style={{ opacity }} />)}</span> Higher · max {formatCount(maximum)}</span>}
          <span>No businesses: faint gray outline</span>
          {metric === "profile_visits" && <><span>Zero visits: unfilled cell</span><span>Unavailable visits: gray fill</span></>}
        </div>
        {/* Native area selection is a keyboard alternative to clicking map cells. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-text-secondary">Selected area
            <select aria-label="Geographic area" value={selected} onChange={(event) => { setHovered(null); selectCell(event.target.value); }} className="max-w-full cursor-pointer rounded-lg border border-stroke bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-info">
              <option value="">Choose a grid cell</option>
              {cells.map((cell) => <option key={cell.id} value={cell.id}>{cell.id} · {formatCount(cell.eligible_businesses)} businesses</option>)}
            </select>
          </label>
          <p role="status" className="text-sm text-text-primary">{current ? `${formatCount(current.eligible_businesses)} businesses · ${formatCount(current.profile_visits)} recorded profile visits${current.eligible_businesses === 0 ? " · No eligible businesses" : ""}` : "Select or hover over a cell to inspect exact counts."}</p>
        </div>
      </AnalyticsSection>
      {/* Exact values, excluded locations and attribution remain in the shared drawer. */}
      <AnalyticsDetailDrawer mode={drawer} onClose={() => setDrawer(null)} title="Geographic Distribution" report={data} interval="selected period" series={[]} showComparison={false}
        aboutContent={<pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ grid: data?.definition, scope: data?.scope, attribution: data?.attribution, sources: data?.sources, reconciliation: data?.reconciliation }, null, 2)}</pre>}
        dataContent={<div className="space-y-5">
          <AnalyticsExactTable caption="All geographic cells in selected taxonomy scope" rows={cells} columns={[
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
