import { useId, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { ReferenceArea } from "recharts";

import { getMetricVariant } from "../../constants/metricVariants";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsTooltip from "../components/AnalyticsTooltip";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsPeriodLabel from "../components/AnalyticsPeriodLabel";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries from "../components/AnalyticsTimeSeries";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { usePlatformGrowthAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import { formatCount, formatDate } from "../utils/presentation";
import {
  growthBucketLabel,
  growthCoverageDescription,
  growthPeriodLabel,
  growthWeekInProgress,
} from "../utils/growthPresentation";

const SERIES = [
  {
    key: "new_consumer_accounts",
    label: "Accounts",
    title: "New Accounts",
    color: "var(--color-primary)",
    explanation: "Accounts whose current role is Explorer or Merchant, excluding administrators and staff. Later role changes or account removal can revise past counts.",
  },
  {
    key: "new_businesses",
    label: "Businesses",
    title: "New Businesses",
    color: "var(--color-info)",
  },
  {
    key: "newly_approved_businesses",
    label: "Business approvals",
    title: "Business Approvals",
    color: "var(--color-success)",
    explanation: "Each business-linked application counts once, at its first recorded approval. Repeat approvals do not count again. This is separate from when the business was created.",
  },
];

/** Shows calendar-week identity alongside the effective dates actually counted. */
export function GrowthTooltip({ active, payload, interval, inProgressDate }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) {
    return null;
  }

  const isWeekly = interval === "weekly";
  const title = isWeekly
    ? `Week of ${formatDate(`${row.date}T00:00:00+08:00`)}`
    : growthPeriodLabel(row.start, row.end_exclusive, true);
  const notes = [];
  if (isWeekly) {
    notes.push(`Counted ${growthPeriodLabel(row.start, row.end_exclusive, true)} (PHT).`);
  }
  if (row.date === inProgressDate) {
    notes.push("Week in progress.");
  }

  return (
    <AnalyticsTooltip
      title={title}
      note={notes.join(" ") || undefined}
      rows={SERIES.map((series) => ({
        label: series.label,
        value: formatCount(row[series.key]),
        color: series.color,
      }))}
    />
  );
}

/** Presents acquisition totals and their comparisons without separate metric cards. */
function GrowthStatistics({ activity }) {
  return (
    <dl className="mb-3 grid min-w-0 grid-cols-1 divide-y divide-stroke min-[480px]:grid-cols-3 min-[480px]:divide-x min-[480px]:divide-y-0">
      {SERIES.map((series) => {
        const metric = activity?.[series.key];
        const change = metric?.change;
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
          <div
            key={series.key}
            className={`relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0 min-[480px]:block min-[480px]:px-3 min-[480px]:py-0 min-[480px]:first:pl-0 min-[480px]:last:pr-0 sm:px-5 [&_details]:static ${
              series.key === "new_consumer_accounts"
                ? "[&_details>div]:left-0 [&_details>div]:right-auto"
                : ""
            }`}
          >
            <dt className="flex min-h-8 flex-wrap items-center gap-x-1 text-xs font-medium leading-5 text-text-secondary">
              <span>{series.title}</span>
              {series.explanation && (
                <AnalyticsDisclosure label={`About ${series.title}`} inline iconOnly>
                  {series.explanation}
                </AnalyticsDisclosure>
              )}
            </dt>
            <dd className="text-2xl font-semibold tracking-tight text-text-primary tabular-nums min-[480px]:mt-1">
              {formatCount(metric?.value)}
            </dd>
            <dd className="col-span-2 space-y-0.5 text-xs leading-5 min-[480px]:mt-1">
              <span className={`flex items-center gap-1.5 font-medium ${getMetricVariant(hasComparison ? variant : "neutral").text}`}>
                {hasComparison && <TrendIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                <span>{hasComparison ? comparison : "Comparison unavailable"}</span>
              </span>
              <span className="block text-text-secondary">
                Previous period: {formatCount(metric?.previous_value)}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Keeps the legend outside the plotting area so it does not compete for height. */
function GrowthLegend({ patternId, inProgressDate }) {
  return (
    <ul aria-label="Growth chart legend" className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-secondary">
      {SERIES.map((series) => (
        <li key={series.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
          {series.label}
        </li>
      ))}
      {inProgressDate && (
        <li className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="12" height="12">
            <rect width="12" height="12" fill={`url(#${patternId})`} stroke="var(--color-stroke)" />
          </svg>
          Week in progress
        </li>
      )}
    </ul>
  );
}

/** Keeps acquisition counts, calendar buckets and source limitations in one report. */
export default function PlatformGrowthSection({ period }) {
  const [interval, setInterval] = useWorkspaceSelection("growth.interval", "weekly");
  const [mode, setMode] = useState(null);
  const query = usePlatformGrowthAnalytics({ ...period, interval });
  const state = useAnalyticsSectionState(query, "growth", "platform growth");
  const data = query.data;
  const patternId = useId().replaceAll(":", "");
  const inProgressDate = growthWeekInProgress(data, interval);
  const reporting = data?.meta?.period;
  const isWeekly = interval === "weekly";
  const empty = data && SERIES.every((series) => data.activity?.[series.key]?.value === 0);

  return (
    <>
      <AnalyticsSection
        title="Platform Growth"
        description="New accounts, businesses, and first approvals."
        compactHeader
        {...state}
        controls={<AnalyticsIntervalControl value={interval} onChange={setInterval} />}
        skeleton={
          <div role="status" aria-label="Loading platform growth">
            <div aria-hidden="true" className="mb-3 grid grid-cols-3 gap-4 motion-safe:animate-pulse">
              {SERIES.map((series) => (
                <div key={series.key} className="space-y-2">
                  <div className="h-3 w-3/4 rounded bg-skeleton" />
                  <div className="h-7 w-1/2 rounded bg-skeleton" />
                  <div className="h-3 w-3/4 rounded bg-skeleton" />
                </div>
              ))}
            </div>
            <div aria-hidden="true" className="h-56 rounded-lg bg-skeleton motion-safe:animate-pulse sm:h-60" />
          </div>
        }
        footer={
          <AnalyticsReportFooter
            title="Platform Growth"
            meta={data?.meta}
            coverageDescription={growthCoverageDescription(data?.meta)}
            hasData={Boolean(data)}
            hasDetails={Boolean(data)}
            onAbout={() => setMode("about")}
            onData={() => setMode("data")}
          />
        }
      >
        <AnalyticsPeriodLabel period={reporting}>
          {" / compared with "}
          {growthPeriodLabel(reporting?.previous_start, reporting?.previous_end_exclusive, true)}
        </AnalyticsPeriodLabel>
        <GrowthStatistics activity={data?.activity} />
        <p className="mb-1 text-xs leading-5 text-text-secondary">
          {isWeekly
            ? "Weekly activity · labels show Monday week starts; counts cover only the selected dates (PHT)."
            : "Daily activity · selected period only (PHT)."}
        </p>
        {empty && (
          <p className="mb-1 text-xs text-text-secondary">
            No growth activity in this period. All reporting buckets are shown below.
          </p>
        )}
        <figure className="min-w-0">
          <figcaption className="sr-only">
            New accounts, businesses and first approvals by {isWeekly ? "calendar week" : "day"}.
            Zero-activity buckets remain on the axis. View data provides exact counts and counted dates.
          </figcaption>
          <div className="h-56 min-w-0 sm:h-60">
            <AnalyticsTimeSeries
              chartType="bar"
              rows={data?.series}
              lines={SERIES}
              showLegend={false}
              barSize={isWeekly ? 24 : undefined}
              maxBarSize={isWeekly ? 24 : 14}
              barGap={isWeekly ? 4 : 2}
              barCategoryGap={isWeekly ? "16%" : "20%"}
              margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
              tooltipContent={<GrowthTooltip interval={interval} inProgressDate={inProgressDate} />}
            >
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
                  label={{
                    value: "In progress",
                    position: "insideTopRight",
                    fill: "var(--color-text-secondary)",
                    fontSize: 10,
                  }}
                />
              )}
            </AnalyticsTimeSeries>
          </div>
          <GrowthLegend patternId={patternId} inProgressDate={inProgressDate} />
        </figure>
      </AnalyticsSection>
      <AnalyticsDetailDrawer
        mode={mode}
        onClose={() => setMode(null)}
        report={data}
        interval={interval}
        series={SERIES}
        dataDescription={isWeekly
          ? "Calendar weeks start Monday. Counted dates are clipped to the selected reporting period (PHT)."
          : "Counted dates are within the selected reporting period (PHT)."}
        dateColumn={{
          key: "date",
          label: isWeekly ? "Week starting / counted dates" : "Counted date",
          render: (row) => isWeekly ? (
            <>
              <span className="block">Week of {formatDate(`${row.date}T00:00:00+08:00`)}</span>
              <span className="block text-xs text-text-secondary">Counted {growthBucketLabel(row)}</span>
            </>
          ) : growthBucketLabel(row),
        }}
      />
    </>
  );
}
