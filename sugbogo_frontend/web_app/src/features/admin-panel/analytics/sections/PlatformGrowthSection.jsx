import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsTooltip from "../components/AnalyticsTooltip";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useId, useState } from "react";
import { ReferenceArea } from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { getMetricVariant } from "../../constants/metricVariants";
import MetricCard from "../../components/MetricCard";
import { usePlatformGrowthAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries from "../components/AnalyticsTimeSeries";
import AnalyticsReportSkeleton from "../components/AnalyticsReportSkeleton";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import { formatCount } from "../utils/presentation";
import { growthPeriodLabel, growthWeekInProgress } from "../utils/growthPresentation";

const SERIES = [
  { key: "new_consumer_accounts", label: "Accounts", title: "New accounts", color: "var(--color-primary)" },
  { key: "new_businesses", label: "Businesses", title: "New businesses", color: "var(--color-info)" },
  { key: "newly_approved_businesses", label: "Business approvals", title: "Business approvals", color: "var(--color-success)" },
];

/** Keeps growth tooltip values in KPI order and describes effective exclusive bucket bounds. */
export function GrowthTooltip({ active, payload, inProgressDate }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <AnalyticsTooltip title={growthPeriodLabel(row.start, row.end_exclusive, true)} note={row.date === inProgressDate ? "Week in progress" : undefined}
    rows={SERIES.map((series) => ({ label: series.label, value: formatCount(row[series.key]), color: series.color }))}
  />;
}

/** Shows all acquisition signals from one report, with secondary detail outside the dashboard card. */
export default function PlatformGrowthSection({ period }) {
  const [interval, setInterval] = useWorkspaceSelection("growth.interval", "weekly");
  const [mode, setMode] = useState(null);
  const query = usePlatformGrowthAnalytics({ ...period, interval });
  const state = useAnalyticsSectionState(query, "growth", "platform growth");
  const data = query.data;
  const patternId = useId().replaceAll(":", "");
  const inProgressDate = growthWeekInProgress(data, interval);
  const reporting = data?.meta?.period;
  const empty = data && SERIES.every((series) => data.activity?.[series.key]?.value === 0);
  return (
    <>
      {/* Shared KPI cards and independent, non-additive bucket counts */}
      <AnalyticsChartCard compact title="Platform Growth" description="New accounts, businesses, and first approvals."
        {...state} partialNotice={null} controls={<AnalyticsIntervalControl value={interval} onChange={setInterval} />}
        skeleton={
          <div role="status" aria-label="Loading platform growth">
            {/* KPI placeholders and stable chart space */}
            <div aria-hidden="true" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SERIES.map((series) => <div key={series.key} className="h-28 rounded-lg bg-skeleton motion-safe:animate-pulse" />)}
            </div>
            <AnalyticsReportSkeleton />
          </div>
        }
        summaryContent={
          <>
            {/* Current chart scope and previous equivalent-period comparison */}
            <AnalyticsPeriodLabel period={reporting}> / compared with {growthPeriodLabel(reporting?.previous_start, reporting?.previous_end_exclusive, true)}</AnalyticsPeriodLabel>
            <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
              {SERIES.map((series) => {
                const activity = data?.activity?.[series.key];
                const change = activity?.change;
                const hasComparison = change?.value != null;
                const TrendIcon = {
                  up: TrendingUp,
                  down: TrendingDown,
                  unchanged: Minus,
                }[change?.direction] ?? Minus;
                const variant = {
                  up: "success",
                  down: "danger",
                  unchanged: "neutral",
                }[change?.direction] ?? "neutral";
                const comparison = change?.direction === "unchanged"
                  ? "No change"
                  : `${formatCount(Math.abs(change?.value))} ${change?.direction === "up" ? "more" : "fewer"}`;

                return (
                  <MetricCard
                    compact
                    dense
                    wrapTitle
                    key={series.key}
                    title={series.title}
                    headerAction={series.key === "new_consumer_accounts" ? <AnalyticsDisclosure label="About New accounts" inline iconOnly comfortable>New accounts includes current Explorer and Merchant roles, excluding administrators and staff. Overview's New Explorer accounts includes only accounts whose current role is Explorer.</AnalyticsDisclosure> : undefined}
                    value={activity?.value == null ? null : formatCount(activity.value)}
                    footerValue={
                      <span className="block space-y-1">
                        {/* Direction and text remain meaningful without color */}
                        <span className={`flex items-center gap-1.5 ${getMetricVariant(hasComparison ? variant : "neutral").text}`}>
                          {hasComparison && <TrendIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                          <span>{hasComparison ? comparison : "Comparison unavailable"}</span>
                        </span>
                        <span className="block font-normal text-text-secondary">
                          Previous period: {formatCount(activity?.previous_value)}
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </div>
            <p className="mb-2 text-xs text-text-secondary">{interval === "weekly" ? "Weekly" : "Daily"} activity · selected period only</p>
          </>
        }
        footer={<AnalyticsReportFooter title="Platform Growth" meta={data?.meta} hasData={Boolean(data)} hasDetails={Boolean(data)} onAbout={() => setMode("about")} onData={() => setMode("data")} />}
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-medium text-text-primary">No growth activity in this period</p>
            <p className="mt-2 text-xs text-text-secondary">There were no new accounts, businesses, or first business approvals recorded.</p>
          </div>
        ) : (
          <AnalyticsTimeSeries
            chartType="bar"
            rows={data?.series}
            lines={SERIES}
            tooltipContent={<GrowthTooltip inProgressDate={inProgressDate} />}
            legendContent={
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-3 text-[11px] text-text-secondary">
                {SERIES.map((series) => <span key={series.key} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />{series.label}</span>)}
                {inProgressDate && <span className="inline-flex items-center gap-1.5"><svg aria-hidden="true" width="12" height="12"><rect width="12" height="12" fill={`url(#${patternId})`} stroke="var(--color-stroke)" /></svg>Week in progress</span>}
              </div>
            }
          >
            {/* Hatch only the report's current-time-capped final week */}
            <defs>
              <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="3" height="8" fill="var(--color-stroke)" />
              </pattern>
            </defs>
            {inProgressDate && (
              <ReferenceArea
                x1={inProgressDate}
                x2={inProgressDate}
                fill={`url(#${patternId})`}
                fillOpacity={0.6}
                stroke="var(--color-stroke)"
                strokeDasharray="3 3"
                label={{ value: "In progress", position: "insideTopRight", fill: "var(--color-text-secondary)", fontSize: 10 }}
              />
            )}
          </AnalyticsTimeSeries>
        )}
      </AnalyticsChartCard>
      {/* Both secondary views share a right-side modal drawer */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} report={data} interval={interval} series={SERIES} />
    </>
  );
}
