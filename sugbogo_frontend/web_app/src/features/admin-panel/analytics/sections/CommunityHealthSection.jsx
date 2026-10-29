import useWorkspaceSelection from "../hooks/useWorkspaceSelection";
import { useCommunityHealthAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries, { AnalyticsSeriesValues } from "../components/AnalyticsTimeSeries";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsDisclosure from "../components/AnalyticsDisclosure";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { comparisonText, formatCount, formatPercentage } from "../utils/presentation";

const LINES = [{ key: "published_review_count", label: "Published reviews", color: "var(--color-neutral)" }];
const SENTIMENTS = [{ name: "positive", label: "Positive", color: "var(--color-success)" }, { name: "neutral", label: "Neutral", color: "var(--color-neutral)" }, { name: "negative", label: "Negative", color: "var(--color-danger)" }];

/** Pairs the publication trend with compact classified sentiment and visible unclassified counts. */
export default function CommunityHealthSection({ period }) {
  const [interval, setInterval] = useWorkspaceSelection("community.interval", "daily");
  const query = useCommunityHealthAnalytics({ ...period, interval });
  const state = useAnalyticsSectionState(query, "community", "community health");
  const data = query.data;
  const cohort = data?.current;
  const rows = SENTIMENTS.map((item) => ({ ...item, ...cohort?.sentiment?.[item.name] }));
  return (
    <AnalyticsChartCard title="Community Health" description="Published review activity and sentiment." {...state}
      controls={<AnalyticsIntervalControl value={interval} onChange={setInterval} />}
      summaryContent={<AnalyticsSummary items={[{ label: "Published reviews in period", value: formatCount(cohort?.published_review_count), context: comparisonText(data?.published_review_count_change) }]} />}
      accessibleData={<div className="mt-3">
        {/* Backend classified shares set segment widths; unclassified is never treated as neutral */}
        <div aria-hidden="true" className="mb-3 flex h-2 overflow-hidden rounded-full bg-surface-muted">{rows.map((row) => row.percentage == null ? null : <div key={row.name} style={{ width: `${row.percentage}%`, backgroundColor: row.color }} />)}</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">{rows.map((row) => <div key={row.name}><dt className="text-text-secondary">{row.label}</dt><dd className="mt-1 font-semibold text-text-primary">{formatPercentage(row.percentage)} <span className="font-normal text-text-secondary">· {formatCount(row.count)}</span></dd></div>)}<div><dt className="text-text-secondary">Unclassified reviews</dt><dd className="mt-1 font-semibold text-text-primary">{formatCount(cohort?.unclassified_review_count)}</dd></div></dl>
        <AnalyticsDisclosure label="Sentiment details"><p>Classified sentiment sample: {formatCount(cohort?.classified_review_count)}. Shares use classified reviews only; unclassified reviews are excluded from the denominator.</p><AnalyticsExactTable caption="Current-period review sentiment" rows={[...rows, { name: "unclassified", label: "Unclassified", count: cohort?.unclassified_review_count, percentage: null }]} columns={[{ key: "label", label: "Classification" }, { key: "count", label: "Reviews", render: (row) => formatCount(row.count) }, { key: "percentage", label: "Share of classified sample", render: (row) => row.name === "unclassified" ? "Excluded from denominator" : formatPercentage(row.percentage) }]} /></AnalyticsDisclosure>
        <AnalyticsSeriesValues title="Review activity" rows={data?.series} lines={LINES} />
      </div>}
      footer={<AnalyticsReportContext meta={data?.meta}><p>Reviews written during the period that are still published today. Later removal or changes to sentiment can revise earlier counts. Sentiment percentages include only classified reviews; unclassified reviews are shown separately. Reviews do not include star ratings.</p></AnalyticsReportContext>}
    >
      {/* Retained-publication trend preserves missing observations */}
      <AnalyticsTimeSeries rows={data?.series} lines={LINES} />
    </AnalyticsChartCard>
  );
}
