import { useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDiscoverySources } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import { formatCount, formatPercentage, formatTimestamp } from "../utils/presentation";

const LABELS = { EXPLORE_DISCOVERY: "Explore", SEARCH_RESULTS: "Search & Results", MAP: "Map", COLLECTION: "Collections", SIMILAR_BUSINESSES: "Similar Businesses", COMMUNITY: "Community", UNKNOWN: "Unknown" };

/** Ranks observations with canonical tie ordering and administrator display labels. */
function sourceRows(sources) {
  const order = Object.keys(LABELS);
  return (sources ?? []).map((row) => ({ ...row, label: LABELS[row.source] ?? row.label }))
    .sort((left, right) => right.count - left.count || order.indexOf(left.source) - order.indexOf(right.source));
}

/** Independently reports recorded opening origins using the shared reporting period. */
export default function DiscoverySourcesSection({ period }) {
  const [mode, setMode] = useState(null);
  const query = useDiscoverySources(period);
  const state = useAnalyticsSectionState(query, "discovery-sources", "discovery sources");
  const data = query.data;
  const rows = sourceRows(data?.sources);
  const unavailable = data?.meta?.availability === "unavailable";
  const actionStyle = "inline-flex cursor-pointer items-center gap-1.5 rounded py-2 text-xs font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50";
  const exact = <AnalyticsExactTable caption="Recorded visits by source" rows={rows} columns={[
    { key: "label", label: "Source" },
    { key: "count", label: "Recorded visits", render: (row) => formatCount(row.count) },
    { key: "share_percent", label: "Recorded share", render: (row) => formatPercentage(row.share_percent) },
  ]} />;
  return (
    <>
      {/* Full-width comparison complements the existing two-column discovery reports. */}
      <AnalyticsSection title="Discovery Sources" description="Where recorded business profile visits originate." {...state}
        controls={data?.meta?.period && <p className="text-xs text-text-secondary">{data.meta.period.start_date} to {data.meta.period.end_date} / PHT</p>}
        unavailable={unavailable} unavailableMessage={<span>Discovery sources are unavailable. This does not mean zero visits. <button type="button" onClick={() => query.refetch()} className={actionStyle}>Retry source</button></span>}
        isEmpty={data?.total_profile_visits === 0} emptyMessage="No profile visits were recorded during this period. View data includes all seven sources."
        footer={<div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4">
          <span className="text-xs text-text-secondary">Updated {formatTimestamp(data?.meta?.generated_at)} PHT{data?.meta?.is_partial ? " · Partial coverage" : ""} <button type="button" aria-label="About Discovery Sources" disabled={!data} onClick={() => setMode("about")} className={actionStyle}><Info aria-hidden="true" className="h-4 w-4" /></button></span>
          <button type="button" disabled={!data} onClick={() => setMode("data")} className={actionStyle}>View data <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
        </div>}
      >
        <div className="h-72 min-w-0" role="img" aria-label="Recorded visits ranked by source. Exact counts and shares are available in View data.">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 45, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={[0, "auto"]} allowDecimals={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={135} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, _name, item) => [`${formatCount(value)} visits · ${formatPercentage(item.payload.share_percent)}`, "Recorded"]} contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-stroke)", borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-primary)" maxBarSize={20} isAnimationActive={false}><LabelList dataKey="count" position="right" formatter={formatCount} fill="var(--color-text-primary)" fontSize={11} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-text-secondary">{formatCount(data?.total_profile_visits)} recorded profile visits</p>
      </AnalyticsSection>
      {/* Existing drawer exposes exact observations and methodology without another modal system. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Discovery Sources" report={data} interval="Selected period" series={[]} showComparison={false}
        dataContent={<>{unavailable ? <p>Exact observations are unavailable.</p> : exact}<p>Total qualifying recorded profile visits: {formatCount(data?.total_profile_visits)}</p></>}
        aboutContent={<div className="space-y-3 border-t border-stroke pt-4 text-sm text-text-secondary">{Object.entries(data?.definitions ?? {}).map(([key, value]) => <p key={key}>{value}</p>)}<p>Limitations: {data?.meta?.partial_reasons?.join(", ")}</p></div>}
      />
    </>
  );
}
