import TableTabs from "../../components/data-table/TableTabs";
import AnalyticsTooltip from "../components/AnalyticsTooltip";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useId, useState } from "react";
import { ReferenceArea } from "recharts";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import AnalyticsSection from "../components/AnalyticsSection";
import { useDiscoveryActivitySummary, useDiscoveryTrend } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries from "../components/AnalyticsTimeSeries";
import { formatCount, formatTimestamp } from "../utils/presentation";
import { growthBucketLabel, growthPeriodLabel } from "../utils/growthPresentation";

const OPTIONS = [
  { value: "profile_visits", label: "Profile visits", color: "var(--color-info)" },
  { value: "impressions", label: "Impressions", color: "var(--color-primary)" },
  { value: "saves", label: "Saves", color: "var(--color-success)" },
  { value: "distinct_engaged_explorers", label: "Participating Accounts", color: "var(--color-neutral)" },
];
const day = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
});

/** Describes one discovery bucket without mixing source methodology into the observation. */
export function DiscoveryTooltip({ active, payload, interval, selected }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <AnalyticsTooltip
    title={interval === "weekly" ? growthPeriodLabel(row.start, row.end_exclusive, true) : day.format(new Date(row.start ?? `${row.date}T00:00:00+08:00`))}
    note={interval === "weekly" && row.in_progress ? "Week in progress" : undefined}
    rows={[{ label: selected.label, value: row.value == null ? "Observation unavailable" : formatCount(row.value), color: selected.color }]}
  />;
}

/** Keeps summary totals compact and recoverable independently of the trend request. */
function DiscoverySummary({ query }) {
  const state = useAnalyticsSectionState(query, "discovery-summary", "discovery summary");
  return (
    <div className="mb-4" aria-busy={query.isFetching}>
      {/* An isolated failure never removes the trend or metric controls */}
      {query.error && <DataErrorState compact title="Unable to load discovery summary" message={`${state.errorMessage}${query.data ? " Previously loaded summary values are shown." : ""}`} onRetry={state.onRetry} retrying={query.isFetching} retryLabel="Retry summary" />}
      {query.data?.meta?.availability === "unavailable" && <p className="mb-2 text-xs text-text-secondary">Discovery summary is currently unavailable.</p>}
      {/* Summary counts remain independent of the selected chart metric. */}
      <dl className="grid min-w-0 grid-cols-3 gap-3" aria-label="Recorded discovery summaries">
        {OPTIONS.slice(0, 3).map((option) => <div key={option.value} className="min-w-0"><dt className="text-xs font-medium text-text-secondary">{option.value === "profile_visits" ? "Profile Visits" : option.label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{query.isLoading && !query.data ? "Loading..." : formatCount(query.data?.totals?.[option.value])}</dd></div>)}
      </dl>
    </div>
  );
}

/** Presents one independently requested discovery metric with source-aware secondary detail. */
export default function DiscoveryActivitySection({ period }) {
  const [metric, setMetric] = useWorkspaceSelection("discovery.metric", "profile_visits");
  const [interval, setInterval] = useWorkspaceSelection("discovery.interval", "weekly");
  const [mode, setMode] = useState(null);
  const patternId = useId().replaceAll(":", "");
  const summaryQuery = useDiscoveryActivitySummary(period);
  const query = useDiscoveryTrend({ ...period, metric, interval });
  const state = useAnalyticsSectionState(query, "discovery", "discovery activity");
  const data = query.data;
  const selected = OPTIONS.find((option) => option.value === metric);
  const lines = [{ key: "value", label: selected.label, color: selected.color }];
  const meta = data?.meta ?? summaryQuery.data?.meta;
  const reporting = meta?.period;
  const timeline = data?.timeline !== undefined ? data.timeline : data?.series;
  const periodStart = reporting?.start ? Date.parse(reporting.start) : Date.parse(`${reporting?.start_date}T00:00:00+08:00`);
  const periodEnd = reporting?.end_exclusive ? Date.parse(reporting.end_exclusive) - 1 : Date.parse(`${reporting?.end_date}T23:59:59.999+08:00`);
  const timeDomain = Number.isFinite(periodStart) && Number.isFinite(periodEnd) ? [periodStart, periodEnd] : undefined;
  const timeTicks = timeline?.map((row) => Date.parse(row.start))
    .filter((tick) => Number.isFinite(tick));
  const through = data?.meta?.data_through ? Date.parse(data.meta.data_through) : null;
  const earlyCutoff = through !== null && through >= periodStart && through < periodEnd;
  const partialWeek = interval === "weekly" && timeline?.at(-1)?.in_progress ? timeline.at(-1) : null;
  const unavailable = Boolean(data && data.value === null && data.series === null);
  const empty = data?.value === 0 && Array.isArray(data?.series) && data.series.every((row) => row.value === 0);
  const hasComparison = data?.change?.value != null;

  return (
    <>
      {/* Selected metric, compact headline and independent report states */}
      <AnalyticsSection onAbout={() => setMode("about")} aboutDisabled={!(data || summaryQuery.data)}
        title="Discovery Activity"
        description="Recorded discovery activity and distinct accounts."
        hasData={Boolean(data || summaryQuery.data)}
        isFetching={Boolean((data || summaryQuery.data) && (query.isFetching || summaryQuery.isFetching))}
        controls={
          <>
            <AnalyticsIntervalControl value={interval} onChange={setInterval} />
          </>
        }
        footer={<AnalyticsReportFooter title="Discovery Activity" meta={meta} hasData={Boolean(data)} hasDetails={Boolean(data || summaryQuery.data)} onData={() => setMode("data")} />}
      >
        <AnalyticsPeriodLabel period={reporting}>{hasComparison && <> / compared with {growthPeriodLabel(reporting?.previous_start, reporting?.previous_end_exclusive, true)}</>}</AnalyticsPeriodLabel>
        <DiscoverySummary query={summaryQuery} />
        {/* Shared DataTable tabs select one trend without changing summary totals. */}
        <div className="mb-4 min-w-0 border-t border-stroke pt-3">
          <p className="text-xs font-medium text-text-secondary">Activity Trend</p>
          <div className="overflow-x-auto pb-1">
            <TableTabs
              size="sm"
              ariaLabel="Activity Trend"
              tabListId="discovery-trend-metrics"
              activeTab={metric}
              onTabChange={setMetric}
              tabs={OPTIONS.map((option) => ({
                id: option.value,
                label: option.value === "profile_visits" ? "Visits" : option.label,
              }))}
            />
          </div>
        </div>
        <div role="tabpanel" id={`discovery-trend-metrics-panel-${metric}`} aria-labelledby={`discovery-trend-metrics-${metric}`} tabIndex={0} className="min-w-0 rounded focus-visible:outline-2 focus-visible:outline-info">
        <AnalyticsChartCard
          compact
          framed={false}
          title={metric === "distinct_engaged_explorers" ? `Distinct discovery participants by ${interval === "weekly" ? "week" : "day"}` : `Recorded ${selected.label.toLowerCase()} by ${interval === "weekly" ? "week" : "day"}`}
          {...state}
          unavailable={unavailable}
          unavailableMessage="Discovery activity is currently unavailable. Summary totals remain independently recoverable."
          summaryContent={
            <div className="mb-3">
              {metric === "distinct_engaged_explorers" && <p className="text-xs text-text-secondary">Accounts with recorded discovery activity during each interval.</p>}
              {empty && <p className="mt-2 text-xs text-text-secondary">No {selected.label.toLowerCase()} were recorded during this period.</p>}
              {earlyCutoff && <p className="mt-2 text-xs text-text-secondary">Recorded coverage through {formatTimestamp(data.meta.data_through)} (PHT).</p>}
              {partialWeek && <p className="mt-2 text-xs text-text-secondary">Week in progress · {growthBucketLabel(partialWeek)}</p>}
              <p className="sr-only">{selected.label}: recorded {interval} observations for the selected period. Unobserved dates remain gaps; the axis covers the selected reporting period. Exact values are available through View data.</p>
            </div>
          }
        >
          {/* Recorded counts retain every bucket; unavailable observations have no bar */}
          {timeline === null ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">
              Recorded discovery observations are currently unavailable. Summary event totals are reported independently above.
            </div>
          ) : (
            <AnalyticsTimeSeries
              rows={timeline ?? []}
              lines={lines}
              chartType="bar"
              barTimeAxis
              maxBarSize={interval === "weekly" ? 40 : 18}
              timeDomain={timeDomain}
              timeTicks={timeTicks}
              showLegend={false}
              tooltipContent={<DiscoveryTooltip interval={interval} selected={selected} />}
            >
              <defs><pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="var(--color-stroke)" /></pattern></defs>
              {earlyCutoff && <ReferenceArea x1={through} x2={periodEnd} fill={`url(#${patternId})`} fillOpacity={0.6} stroke="none" label={{ value: "Coverage ends", position: "insideTopRight", fontSize: 10, fill: "var(--color-text-secondary)" }} />}
              {partialWeek && <ReferenceArea x1={Date.parse(partialWeek.start)} x2={Date.parse(partialWeek.end_exclusive) - 1} fill={`url(#${patternId})`} fillOpacity={0.4} stroke="none" />}
            </AnalyticsTimeSeries>
          )}
        </AnalyticsChartCard>
        </div>
      </AnalyticsSection>
      {/* Shared animated drawer keeps methodology and exact data outside the card */}
      <AnalyticsDetailDrawer
        mode={mode}
        onClose={() => setMode(null)}
        title="Discovery Activity"
        report={{ ...data, meta, series: timeline }}
        interval={interval}
        series={lines}
        dataDescription={selected.label}
        dateColumn={{
          key: "date",
          label: interval === "weekly" ? "Effective dates" : "Date",
          render: (row) => interval === "weekly"
            ? growthBucketLabel(row)
            : day.format(new Date(row.start ?? `${row.date}T00:00:00+08:00`)),
        }}
        showComparison={hasComparison}

      />
    </>
  );
}
