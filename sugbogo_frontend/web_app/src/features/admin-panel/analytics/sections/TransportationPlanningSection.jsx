import AnalyticsTooltip from "../components/AnalyticsTooltip";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTransportationPlanning } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import { formatCount, formatPercentage, formatTimestamp } from "../utils/presentation";
import { growthBucketLabel } from "../utils/growthPresentation";

const COLORS = { ROAD_ROUTE: "var(--color-info)", JEEPNEY: "var(--color-primary)", OTHER: "var(--color-neutral)" };
const shares = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatShare = (value) => value == null ? "Unavailable" : `${shares.format(value)}%`;
const METHOD_COLUMNS = [
  { key: "label", label: "Method" },
  { key: "count", label: "Recorded requests", render: (row) => formatCount(row.count) },
  { key: "share_percent", label: "Share", render: (row) => formatPercentage(row.share_percent) },
];
const COUNT_COLUMNS = [
  ["road_route", "Road routes"], ["jeepney", "Jeepney guidance"], ["other", "Other"],
].map(([key, label]) => ({ key, label, render: (row) => formatCount(row[key]) }));

/** Uses display-only rounding while leaving exact method shares available in View data. */
function PlanningMethodTooltip({ active, payload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <AnalyticsTooltip title={row.label} rows={[
    { label: "Recorded requests", value: formatCount(row.count), color: COLORS[row.method] },
    { label: "Share of recorded total", value: formatShare(row.share_percent) },
  ]} />;
}

/** Shows recorded planning intent with exact observations and destinations in the shared drawer. */
export default function TransportationPlanningSection({ period }) {
  const [interval, setInterval] = useWorkspaceSelection("transportation.interval", "weekly");
  const [mode, setMode] = useState(null);
  const query = useTransportationPlanning({ ...period, interval });
  const state = useAnalyticsSectionState(query, "transportation", "transportation planning");
  const data = query.data;
  const unavailable = data?.meta?.availability === "unavailable";
  const actionStyle = "inline-flex cursor-pointer items-center gap-1.5 rounded py-2 text-xs font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50";
  const methods = data?.methods ?? [];
  const legendMethods = methods.filter((row) => row.method !== "OTHER" || row.count !== 0);
  return (
    <>
      {/* Compact distribution keeps secondary trends and rankings out of the main workspace. */}
      <AnalyticsSection title="Transportation Planning" description="Recorded road-route and Jeepney guidance planning requests." {...state}
        unavailable={unavailable}
        unavailableMessage={<span>{data?.meta?.partial_reasons?.includes("tracking_not_started_in_period") ? "This period is before transportation tracking began." : "Transportation planning observations are unavailable, not zero."} <button type="button" onClick={() => query.refetch()} className={actionStyle}>Retry source</button></span>}
        isEmpty={data?.total_requests === 0}
        emptyMessage="No transportation-planning requests were recorded during the observed portion of this period."
        footer={<AnalyticsReportFooter title="Transportation Planning" meta={data?.meta} hasData={Boolean(data)} hasDetails={Boolean(data)} onAbout={() => setMode("about")} onData={() => setMode("data")} />}
      >
        <AnalyticsPeriodLabel period={data?.meta?.period} />
        <div className="grid min-w-0 items-center gap-4 sm:grid-cols-2">
          <div className="relative mx-auto h-56 w-full max-w-xs" role="img" aria-label={`${formatCount(data?.total_requests)} recorded planning requests. Exact method counts and shares follow.`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={methods} dataKey="count" nameKey="label" innerRadius="65%" outerRadius="85%" isAnimationActive={false} stroke="var(--color-background)">
                  {methods.map((row) => <Cell key={row.method} fill={COLORS[row.method]} />)}
                </Pie>
                <Tooltip content={<PlanningMethodTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold text-text-primary">{formatCount(data?.total_requests)}</span><span className="text-xs text-text-secondary">recorded requests</span></div>
          </div>
          <div className="min-w-0">
            <dl className="space-y-3 text-sm">{legendMethods.map((row) => <div key={row.method} className="flex flex-wrap items-center justify-between gap-2"><dt className="flex items-center gap-2 text-text-secondary"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[row.method] }} />{row.label}</dt><dd className="tabular-nums"><span className="font-semibold text-text-primary">{formatCount(row.count)}</span><span className="text-text-secondary"> · {formatShare(row.share_percent)}</span></dd></div>)}</dl>
            <p className="mt-5 text-sm text-text-secondary">Distinct requesting accounts: <span className="font-medium text-text-primary">{formatCount(data?.distinct_requesting_accounts)}</span></p>
            <p className="mt-2 text-xs text-text-secondary">Planning intent, not completed journeys or physical visits.</p>
          </div>
        </div>
      </AnalyticsSection>
      {/* Shared modal retains methodology, bounded destination ranking, and exact time buckets. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Transportation Planning" report={data} interval={interval} series={[]} showComparison={false}
        aboutContent={<div className="space-y-3 border-t border-stroke pt-4 text-sm text-text-secondary"><p>Data source: MongoDB route_planning_events.</p><p>Tracking started: {formatTimestamp(data?.tracking_started_at)} PHT.</p>{Object.entries(data?.definitions ?? {}).map(([key, value]) => <p key={key}>{value}</p>)}<p>Limitations: {data?.meta?.partial_reasons?.join(", ")}</p></div>}
        dataContent={unavailable ? <p>Exact observations are unavailable. See report details for the tracking boundary and source limitations.</p> : <div className="space-y-5">
          <p>{formatCount(data?.total_requests)} recorded requests · {formatCount(data?.distinct_requesting_accounts)} distinct requesting accounts</p>
          <AnalyticsExactTable caption="Planning methods" rows={methods} columns={METHOD_COLUMNS} />
          {/* Interval changes affect exact time buckets, not the period-wide composition. */}
          <AnalyticsIntervalControl value={interval} onChange={setInterval} />
          <AnalyticsExactTable caption={`Recorded planning activity · ${interval}`} rows={data?.series} columns={[
            { key: "date", label: "Effective dates", render: growthBucketLabel },
            { key: "observation_start", label: "Observation begins · PHT", render: (row) => formatTimestamp(row.observation_start) },
            ...COUNT_COLUMNS,
          ]} />
          <AnalyticsExactTable caption="Top recorded destinations" rows={data?.destinations} columns={[
            { key: "business_name", label: "Business", render: (row) => row.business_name && row.business_id ? <Link className="cursor-pointer underline focus-visible:outline-2 focus-visible:outline-info" to={`/admin-panel/businesses/${row.business_id}`}>{row.business_name}</Link> : "Unavailable business" },
            { key: "count", label: "Requests", render: (row) => formatCount(row.count) },
            ...COUNT_COLUMNS,
          ]} />
          <p className="text-xs text-text-secondary">Top {formatCount(data?.destination_limit)} destination IDs. Unavailable businesses in ranking: {formatCount(data?.unavailable_destinations_in_ranking)}. No destination events excluded. Requests without usable account identity: {formatCount(data?.requests_without_account_identity)}.</p>
        </div>}
      />
    </>
  );
}
