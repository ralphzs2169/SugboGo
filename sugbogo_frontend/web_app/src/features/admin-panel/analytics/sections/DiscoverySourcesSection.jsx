import { AnalyticsCategoryTooltip } from "../components/AnalyticsTooltip";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import { useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDiscoverySources } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import { formatCount, formatPercentage } from "../utils/presentation";

const LABELS = { EXPLORE_DISCOVERY: "Explore", SEARCH_RESULTS: "Search & Results", MAP: "Map", COLLECTION: "Collections", SIMILAR_BUSINESSES: "Similar Businesses", COMMUNITY: "Community", UNKNOWN: "Unknown" };

/** Ranks observations with Unknown last, canonical tie ordering and administrator display labels. */
function sourceRows(sources) {
  const order = Object.keys(LABELS);
  return (sources ?? []).map((row) => ({ ...row, label: LABELS[row.source] ?? row.label, color: row.source === "UNKNOWN" ? "var(--color-neutral)" : "var(--color-primary)" }))
    .sort((left, right) => Number(left.source === "UNKNOWN") - Number(right.source === "UNKNOWN") || right.count - left.count || order.indexOf(left.source) - order.indexOf(right.source));
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
      <AnalyticsSection onAbout={() => setMode("about")} aboutDisabled={!data} title="Discovery Sources" description="Where recorded business profile visits originate." {...state}
        unavailable={unavailable} unavailableMessage={<span>Discovery sources are unavailable. This does not mean zero visits. <button type="button" onClick={() => query.refetch()} className={actionStyle}>Retry source</button></span>}
        isEmpty={data?.total_profile_visits === 0} emptyMessage="No profile visits were recorded during this period. View data includes all seven sources."
        footer={<AnalyticsReportFooter title="Discovery Sources" meta={data?.meta} hasData={Boolean(data)} hasDetails={Boolean(data)} onData={() => setMode("data")} />}
      >
        <AnalyticsPeriodLabel period={data?.meta?.period} />
        <div className="mx-auto h-80 w-full xl:h-112 min-w-0 max-w-4xl" role="img" aria-label="Recorded visits ranked by source, with Unknown shown last. Exact counts and shares are available in View data.">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 64, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={[0, "auto"]} allowDecimals={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={150} interval={0} tick={{ fill: "var(--color-text-primary)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AnalyticsCategoryTooltip unit="visits" />} />
              <Bar dataKey="count" fill="var(--color-primary)" maxBarSize={28} isAnimationActive={false}>{rows.map((row) => <Cell key={row.source} fill={row.color} />)}<LabelList dataKey="count" position="right" formatter={formatCount} fill="var(--color-text-primary)" fontSize={11} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-text-secondary">Unknown means the opening source was missing or unrecognized. These visits remain included in the total.</p>
        <p className="mt-2 text-sm text-text-secondary">{formatCount(data?.total_profile_visits)} recorded profile visits</p>
      </AnalyticsSection>
      {/* Existing drawer exposes exact observations and methodology without another modal system. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Discovery Sources" report={data} interval="Selected period" series={[]} showComparison={false}
        dataContent={<>{unavailable ? <p>Exact observations are unavailable.</p> : exact}<p>Total qualifying recorded profile visits: {formatCount(data?.total_profile_visits)}</p></>}

      />
    </>
  );
}
