import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useId, useState } from "react";
import { ReferenceArea } from "recharts";
import { ArrowRight, Info } from "lucide-react";
import MetricCard from "../../components/MetricCard";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import AnalyticsSection from "../components/AnalyticsSection";
import { useDiscoveryActivitySummary, useDiscoveryTrend } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries from "../components/AnalyticsTimeSeries";
import { comparisonText, formatCount, formatTimestamp } from "../utils/presentation";
import { growthBucketLabel, growthPeriodLabel } from "../utils/growthPresentation";

const OPTIONS = [
  { value: "profile_visits", label: "Profile visits", color: "var(--color-info)" },
  { value: "impressions", label: "Impressions", color: "var(--color-primary)" },
  { value: "saves", label: "Saves", color: "var(--color-success)" },
  { value: "distinct_engaged_explorers", label: "Discovery-active accounts", color: "var(--color-neutral)" },
];
const day = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
});

/** Describes one discovery bucket without mixing source methodology into the observation. */
function DiscoveryTooltip({ active, payload, interval, selected }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-40 rounded-lg border border-stroke bg-background p-3 text-xs text-text-primary shadow-lg">
      {/* Effective bucket date and selected observation */}
      <p className="font-semibold">
        {interval === "weekly" ? growthBucketLabel(row) : day.format(new Date(row.start ?? `${row.date}T00:00:00+08:00`))}
      </p>
      {interval === "weekly" && row.in_progress && <p className="mt-1 text-text-secondary">Week in progress</p>}
      <div className="mt-2 flex items-center justify-between gap-5">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ backgroundColor: selected.color }} />{selected.label}</span>
        <span className="font-semibold tabular-nums">{row.value == null ? "Observation unavailable" : formatCount(row.value)}</span>
      </div>
    </div>
  );
}

/** Keeps summary totals selectable and recoverable independently of the trend request. */
function DiscoverySummary({ query, metric, onSelect }) {
  const state = useAnalyticsSectionState(query, "discovery-summary", "discovery summary");
  return (
    <div className="mb-4" aria-busy={query.isFetching}>
      {/* An isolated failure never removes the trend or metric controls */}
      {query.error && <DataErrorState compact title="Unable to load discovery summary" message={state.errorMessage} onRetry={state.onRetry} retrying={query.isFetching} retryLabel="Retry summary" />}
      {query.data?.meta?.availability === "unavailable" && <p className="mb-2 text-xs text-text-secondary">Discovery summary is currently unavailable.</p>}
      {query.isLoading && !query.data ? (
        <div role="status" aria-label="Loading discovery summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPTIONS.slice(0, 3).map((option) => <div key={option.value} aria-hidden="true" className="h-28 rounded-xl bg-skeleton motion-safe:animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Recorded discovery metric">
          {OPTIONS.slice(0, 3).map((option) => (
            <MetricCard
              key={option.value}
              compact
              dense
              wrapTitle
              title={option.label}
              value={query.data?.totals?.[option.value] == null ? null : formatCount(query.data.totals[option.value])}
              headerAction={
                <button
                  type="button"
                  aria-label={`Show recorded ${option.label.toLowerCase()}`}
                  aria-pressed={metric === option.value}
                  onClick={() => onSelect(option.value)}
                  style={metric === option.value ? { boxShadow: `inset 0 -2px 0 ${option.color}` } : undefined}
                  className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
                >

                </button>
              }
            />
          ))}
        </div>
      )}
      {/* A compact fourth choice avoids repeating Overview's period-wide account total. */}
      <button
        type="button"
        aria-label="Show recorded discovery-active accounts"
        aria-pressed={metric === "distinct_engaged_explorers"}
        onClick={() => onSelect("distinct_engaged_explorers")}
        className={`mt-3 cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-info ${metric === "distinct_engaged_explorers" ? "border-text-primary bg-surface text-text-primary" : "border-stroke text-text-secondary"}`}
      >
        Discovery-active accounts
      </button>
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
  const definitions = summaryQuery.data?.definitions ?? data?.definitions;
  const unavailable = Boolean(data && data.value === null && data.series === null);
  const empty = data?.value === 0 && Array.isArray(data?.series) && data.series.every((row) => row.value === 0);
  const hasComparison = data?.change?.value != null;

  return (
    <>
      {/* Selected metric, compact headline and independent report states */}
      <AnalyticsSection
        title="Discovery Activity"
        description="Recorded discovery activity and distinct accounts."
        hasData={Boolean(data || summaryQuery.data)}
        isFetching={Boolean((data || summaryQuery.data) && (query.isFetching || summaryQuery.isFetching))}
        controls={
          <>
            <AnalyticsIntervalControl value={interval} onChange={setInterval} />
          </>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4 text-xs text-text-secondary">
            <div className="flex items-center gap-1">
              <span>Updated {formatTimestamp(meta?.generated_at)} (PHT){(data?.meta?.is_partial || summaryQuery.data?.meta?.is_partial) ? " · Partial coverage" : ""}</span>
              <button
                type="button"
                aria-label="About Discovery Activity"
                disabled={!data && !summaryQuery.data}
                onClick={() => setMode("about")}
                className="cursor-pointer rounded p-1 focus-visible:outline-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Info aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={!data}
              onClick={() => setMode("data")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded py-2 font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50"
            >
              View data
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <p className="mb-3 text-xs leading-relaxed text-text-secondary">
          <span className="font-medium text-text-primary">
            {reporting ? growthPeriodLabel(reporting.start ?? `${reporting.start_date}T00:00:00+08:00`, reporting.end_exclusive ?? `${reporting.end_date}T23:59:59.999+08:00`, true) : "Unavailable"}
          </span>
          {hasComparison && <> · compared with {growthPeriodLabel(reporting?.previous_start, reporting?.previous_end_exclusive, true)}</>}
        </p>
        <DiscoverySummary query={summaryQuery} metric={metric} onSelect={setMetric} />
        <AnalyticsChartCard
          compact
          framed={false}
          title={`Recorded ${selected.label.toLowerCase()} by ${interval === "weekly" ? "week" : "day"}`}
          {...state}
          unavailable={unavailable}
          unavailableMessage="Discovery activity is currently unavailable. Summary totals remain independently recoverable."
          summaryContent={
            <div className="mb-3">
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
        aboutContent={
          <div className="space-y-3 border-t border-stroke pt-5 text-sm text-text-secondary">
            <h3 className="font-semibold text-text-primary">How these metrics work</h3>
            {OPTIONS.map((option) => <div key={option.value}><h4 className="font-medium text-text-primary">{option.label}</h4><p>{option.value === "distinct_engaged_explorers" ? "Distinct accounts with recorded impressions, profile visits or saves, including Explorer and Merchant actors. Historical account roles are not reconstructed. This is not general app activity, DAU, MAU or retention." : definitions?.[option.value] ?? "Definition unavailable"}</p></div>)}
            <p>Account counts are distinct within each day or week. The same account may appear in several buckets, so bucket counts must never be summed into a period total. No additional account total is calculated here.</p>
            <p>{definitions?.deduplication ?? data?.description}</p>
            <p>{definitions?.missing_observations ?? "Unobserved buckets are unavailable, not measured zeroes. No source watermark is inferred from the last event."}</p>
            <p>Tracking freshness: {meta?.data_through ? formatTimestamp(meta.data_through) : "Unknown; the last event does not establish coverage."}</p>
            <h3 className="font-semibold text-text-primary">Comparison availability</h3>
            <p>{definitions?.comparisons ?? "Previous-period comparisons are hidden while discovery tracking coverage is not fully verified."}</p>
            {hasComparison && <p>Previous period: {formatCount(data?.previous_value)} · {comparisonText(data.change)}</p>}
            {summaryQuery.data?.meta && <p>Summary generated: {formatTimestamp(summaryQuery.data.meta.generated_at)} (PHT). Summary source: {summaryQuery.data.meta.availability}.</p>}
            {data?.meta?.partial_reasons?.length > 0 && (
              <ul className="list-disc space-y-1 pl-4">
                {data.meta.partial_reasons.map((reason) => <li key={reason}>{reason.replaceAll("_", " ")}</li>)}
              </ul>
            )}
          </div>
        }
      />
    </>
  );
}
