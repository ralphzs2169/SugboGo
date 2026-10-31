import { useState } from "react";
import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useCommunityHealthAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries from "../components/AnalyticsTimeSeries";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDetailDrawer from "../components/AnalyticsDetailDrawer";
import AnalyticsReportFooter from "../components/AnalyticsReportFooter";
import AnalyticsReportExplanation from "../components/AnalyticsReportExplanation";
import AnalyticsReliability from "../components/AnalyticsReliability";
import { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { comparisonText, formatCount, formatDate, formatPercentage, formatTimestamp } from "../utils/presentation";

const LINES = [{ key: "published_review_count", label: "Published reviews", color: "var(--color-neutral)" }];
const SENTIMENTS = [{ name: "positive", label: "Positive", color: "var(--color-success)" }, { name: "neutral", label: "Neutral", color: "var(--color-neutral)" }, { name: "negative", label: "Negative", color: "var(--color-danger)" }];

/** Pairs the publication trend with compact classified sentiment and visible unclassified counts. */
export default function CommunityHealthSection({ period }) {
  const [mode, setMode] = useState(null);
  const [interval, setInterval] = useWorkspaceSelection("community.interval", "daily");
  const query = useCommunityHealthAnalytics({ ...period, interval });
  const state = useAnalyticsSectionState(query, "community", "community health");
  const data = query.data;
  const cohort = data?.current;
  const rows = SENTIMENTS.map((item) => ({ ...item, ...cohort?.sentiment?.[item.name] }));
  return (
    <>
      <AnalyticsChartCard onAbout={() => setMode("about")} aboutDisabled={!data} title="Community Health" description="Published review activity and sentiment." {...state}
        controls={<AnalyticsIntervalControl value={interval} onChange={setInterval} />}
        summaryContent={<AnalyticsSummary items={[{ label: "Published reviews in period", value: formatCount(cohort?.published_review_count), context: comparisonText(data?.published_review_count_change) }]} />}
        accessibleData={<div className="mt-3">
          {/* Backend classified shares set segment widths; unclassified is never treated as neutral */}
          <div aria-hidden="true" className="mb-3 flex h-2 overflow-hidden rounded-full bg-surface-muted">{rows.map((row) => row.percentage == null ? null : <div key={row.name} style={{ width: `${row.percentage}%`, backgroundColor: row.color }} />)}</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">{rows.map((row) => <div key={row.name}><dt className="text-text-secondary">{row.label}</dt><dd className="mt-1 font-semibold text-text-primary">{formatPercentage(row.percentage)} <span className="font-normal text-text-secondary">· {formatCount(row.count)}</span></dd></div>)}<div><dt className="text-text-secondary">Unclassified reviews</dt><dd className="mt-1 font-semibold text-text-primary">{formatCount(cohort?.unclassified_review_count)}</dd></div></dl>
        </div>}
        footer={<AnalyticsReportFooter title="Community Health" meta={data?.meta} hasData={Boolean(data)} onData={() => setMode("data")} />}
      >
        {/* Retained-publication trend preserves missing observations */}
        <AnalyticsTimeSeries rows={data?.series} lines={LINES} />
      </AnalyticsChartCard>
      {/* Shared drawer holds exact buckets, sentiment counts and methodology. */}
      <AnalyticsDetailDrawer mode={mode} onClose={() => setMode(null)} title="Community Health"
        report={data} interval={interval} series={LINES} showComparison={false}

        dataContent={<div className="space-y-5">
          <div>
            <h3 className="mb-3 font-semibold">Exact review activity · {interval}</h3>
            {data?.series === null ? <p className="text-text-secondary">Exact observations are currently unavailable.</p> : (
              <AnalyticsExactTable caption="Review activity exact reporting buckets" rows={data?.series} columns={[
                { key: "date", label: "Bucket date", render: (row) => formatDate(row.date) },
                { key: "start", label: "Start (PHT)", render: (row) => formatTimestamp(row.start) },
                { key: "end_exclusive", label: "End (exclusive, PHT)", render: (row) => formatTimestamp(row.end_exclusive) },
                { key: "published_review_count", label: "Published reviews", render: (row) => formatCount(row.published_review_count) },
              ]} />
            )}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Sentiment details</h3>
            <p className="mb-3 text-xs text-text-secondary">Classified sentiment sample: {formatCount(cohort?.classified_review_count)}. Unclassified reviews are excluded from percentage shares.</p>
            <AnalyticsExactTable caption="Current-period review sentiment" rows={[...rows, { name: "unclassified", label: "Unclassified", count: cohort?.unclassified_review_count, percentage: null }]} columns={[
              { key: "label", label: "Classification" },
              { key: "count", label: "Reviews", render: (row) => formatCount(row.count) },
              { key: "percentage", label: "Share of classified sample", render: (row) => row.name === "unclassified" ? "Excluded from denominator" : formatPercentage(row.percentage) },
            ]} />
          </div>
          <AnalyticsReportExplanation title="Community Health" report={data} />
          <AnalyticsReliability meta={data?.meta} />
        </div>}
      />
    </>
  );
}
