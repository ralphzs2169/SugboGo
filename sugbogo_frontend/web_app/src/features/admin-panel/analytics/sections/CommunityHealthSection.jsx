import { useState } from "react";
import { useCommunityHealthAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries, { AnalyticsSeriesValues } from "../components/AnalyticsTimeSeries";
import AnalyticsExactTable from "../components/AnalyticsExactTable";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { comparisonText, formatCount, formatPercentage } from "../utils/presentation";

const LINES = [{ key: "published_review_count", label: "Currently published review cohort" }];

/** Pairs retained publication activity with classified sentiment and explicit unclassified counts. */
export default function CommunityHealthSection({ period }) {
  const [interval, setInterval] = useState("daily");
  const query = useCommunityHealthAnalytics({ ...period, interval });
  const state = useAnalyticsSectionState(query, "community", "community health");
  const data = query.data;
  const cohort = data?.current;
  const sentimentRows = ["positive", "neutral", "negative"].map((name) => ({ name, ...cohort?.sentiment?.[name] }));
  sentimentRows.push({ name: "unclassified", count: cohort?.unclassified_review_count, percentage: null });
  return (
    <AnalyticsChartCard title="Community Health" description="Reviews created during the period that remain published now. Later moderation, deletion or classification can revise history." {...state}
      controls={<AnalyticsIntervalControl value={interval} onChange={setInterval} />}
      summaryContent={<AnalyticsSummary items={[{ label: "Published reviews in period", value: formatCount(cohort?.published_review_count), context: comparisonText(data?.published_review_count_change) }, { label: "Classified sentiment sample", value: formatCount(cohort?.classified_review_count) }, { label: "Unclassified reviews", value: formatCount(cohort?.unclassified_review_count) }]} />}
      summary={cohort?.published_review_count === 0 ? "No currently published reviews were created during this period." : "Review volume uses current retained publication state, not immutable publication history."}
      accessibleData={<div className="mt-5 space-y-4"><h3 className="text-sm font-semibold text-text-primary">Sentiment composition</h3><AnalyticsExactTable caption="Current-period review sentiment" rows={sentimentRows} columns={[{ key: "name", label: "Classification" }, { key: "count", label: "Reviews", render: (row) => formatCount(row.count) }, { key: "percentage", label: "Share of classified sample", render: (row) => row.name === "unclassified" ? "Excluded from denominator" : formatPercentage(row.percentage) }]} /><AnalyticsSeriesValues title="Review activity" rows={data?.series} lines={LINES} /></div>}
      footer={<AnalyticsReportContext meta={data?.meta}><p>Sentiment shares use classified reviews only. No numeric ratings are collected.</p></AnalyticsReportContext>}
    >
      {/* Publication cohort trend and exact sentiment composition */}
      <AnalyticsTimeSeries rows={data?.series} lines={LINES} />
    </AnalyticsChartCard>
  );
}
