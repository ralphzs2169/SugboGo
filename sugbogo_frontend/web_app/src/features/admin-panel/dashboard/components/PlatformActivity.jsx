import { useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { Line } from "recharts";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import AnalyticsTimeSeries from "../../analytics/components/AnalyticsTimeSeries";
import AnalyticsTooltip from "../../analytics/components/AnalyticsTooltip";
import AnalyticsPeriodLabel from "../../analytics/components/AnalyticsPeriodLabel";
import AnalyticsReportFooter from "../../analytics/components/AnalyticsReportFooter";
import AnalyticsSection from "../../analytics/components/AnalyticsSection";
import {
  formatCount,
  sectionQueryState,
} from "../../analytics/utils/presentation";
import {
  activitySeries,
  platformActivityDays,
  platformActivityMaximum,
} from "../utils/platformActivity";
import useChartEntrance from "../hooks/useChartEntrance";

/** Explain the exact server date and visible series counts without inferring comparisons. */
export function ActivityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date ?? label;
  const fullDate = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
    timeZone: "Asia/Manila",
  }).format(
    new Date(typeof date === "number" ? date : `${date}T00:00:00+08:00`),
  );
  return (
    <AnalyticsTooltip
      title={`${fullDate} PHT`}
      rows={payload.map((entry) => ({
        label: entry.name,
        value: formatCount(entry.value),
        color: entry.color,
      }))}
    />
  );
}

/** Plot seven real Manila-date buckets with isolatable series, a shared count axis, and exact-value text. */
export default function PlatformActivity({ query, onAbout, onData }) {
  const activity = query.data?.activity;
  const asOf = query.data?.as_of;
  const onRetry = () => query.refetch();
  const isFetching = query.isFetching;
  const [visible, setVisible] = useState(activitySeries.map(({ key }) => key));
  const rows = platformActivityDays(activity);
  const animation = useChartEntrance(rows);
  const maximum = platformActivityMaximum(rows, visible);
  const window = activity?.window;
  const empty = rows?.every((row) =>
    activitySeries.every(({ key }) => row[key] === 0),
  );
  function isolate(key) {
    animation.stop();
    setVisible((current) =>
      current.length === 1 && current[0] === key
        ? activitySeries.map((series) => series.key)
        : [key],
    );
  }
  const period = { start_date: rows?.[0]?.date, end_date: rows?.at(-1)?.date };
  const meta = {
    generated_at: asOf,
    period,
    is_partial: window?.includes_partial_day,
  };
  return (
    <section
      aria-label="Platform Activity Trend"
      className="min-w-0 [&>section]:h-full"
    >
      <AnalyticsSection
        title="Platform Activity Trend"
        titleIcon={ChartNoAxesCombined}
        description="Last 7 calendar dates · PHT · recorded events"
        onAbout={onAbout}
        {...sectionQueryState(query)}
        errorMessage="Unable to load platform activity. Please try again."
        footer={
          <AnalyticsReportFooter
            title="Platform Activity Trend"
            timestampLabel="Data as of"
            meta={meta}
            hasData={Boolean(rows)}
            hasDetails={Boolean(activity)}
            coverageLabel="Today is partial"
            coverageDescription="Recorded events in the server-selected PHT window, start-inclusive and end-exclusive. The current day may be partial; the chart does not show a previous-period series."
            onData={onData}
          />
        }
      >
        <AnalyticsPeriodLabel
          period={{ start_date: rows?.[0]?.date, end_date: rows?.at(-1)?.date }}
        />
        {!window && (
          <p className="mb-3 text-xs text-text-secondary">
            Activity window unavailable.
          </p>
        )}
        {/* Keyboard legend isolates large series without introducing independent scales */}
        <div
          role="group"
          aria-label="Activity series visibility"
          className="mb-3 flex flex-wrap gap-2"
        >
          {activitySeries.map((series) => (
            <button
              key={series.key}
              type="button"
              disabled={!rows}
              aria-pressed={visible.includes(series.key)}
              onClick={() => isolate(series.key)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info aria-pressed:font-semibold aria-pressed:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" width="20" height="4">
                <line
                  x1="0"
                  y1="2"
                  x2="20"
                  y2="2"
                  stroke={series.color}
                  strokeWidth="2"
                  strokeDasharray={series.dash}
                />
              </svg>
              {series.label}
              <span className="tabular-nums">
                — {formatCount(activity?.[series.key])}
              </span>
            </button>
          ))}
          {visible.length !== activitySeries.length && (
            <button
              type="button"
              onClick={() => {
                animation.stop();
                setVisible(activitySeries.map(({ key }) => key));
              }}
              className="min-h-9 cursor-pointer rounded px-2 text-xs font-medium text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
            >
              Show all series
            </button>
          )}
        </div>
        <p className="sr-only">
          Select a series to isolate it; select it again to show all. All series
          use the same count axis.
        </p>
        {/* The plot never pads missing observations or changes the server's window */}
        {!rows ? (
          <DataErrorState
            compact
            title="Daily activity is unavailable"
            message="Seven consecutive dated counts are required. Please try again."
            onRetry={onRetry}
            retrying={isFetching}
            retryLabel="Retry"
          />
        ) : (
          <>
            {empty && (
              <p className="mb-3 text-sm text-text-secondary">
                No recorded platform activity in this window.
              </p>
            )}
            <div aria-hidden="true" className="h-52 min-w-0 sm:h-56">
              <AnalyticsTimeSeries
                rows={rows}
                lines={[]}
                showLegend={false}
                tooltipContent={<ActivityTooltip />}
                yDomain={[0, maximum]}
                margin={{ top: 10, right: 16, bottom: 0, left: 8 }}
              >
                {activitySeries
                  .filter(({ key }) => visible.includes(key))
                  .map((series) => (
                    <Line
                      key={series.key}
                      dataKey={series.key}
                      name={series.label}
                      type="linear"
                      connectNulls={false}
                      stroke={series.color}
                      strokeDasharray={series.dash}
                      strokeWidth={2}
                      dot={visible.length === 1 ? { r: 2 } : false}
                      activeDot={{ r: 5 }}
                      isAnimationActive={animation.isAnimationActive}
                      animationDuration={animation.animationDuration}
                      animationEasing={animation.animationEasing}
                      onAnimationEnd={animation.onAnimationEnd}
                    />
                  ))}
              </AnalyticsTimeSeries>
            </div>
          </>
        )}
      </AnalyticsSection>
    </section>
  );
}
