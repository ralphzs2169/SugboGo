import { useState } from "react";
import { usePlatformGrowthAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries, { AnalyticsSeriesValues } from "../components/AnalyticsTimeSeries";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { comparisonText, formatCount } from "../utils/presentation";

const OPTIONS = [
  { value: "new_consumer_accounts", label: "Accounts" },
  { value: "new_businesses", label: "Businesses" },
  { value: "newly_approved_businesses", label: "Business approvals" },
];

/** Compares acquisition events on one selectable timeline; inventory never enters the series. */
export default function PlatformGrowthSection({ period }) {
  const [metric, setMetric] = useState("new_consumer_accounts");
  const [interval, setInterval] = useState("daily");
  const query = usePlatformGrowthAnalytics({ ...period, interval });
  const state = useAnalyticsSectionState(query, "growth", "platform growth");
  const data = query.data;
  const activity = data?.activity?.[metric];
  const label = OPTIONS.find((option) => option.value === metric).label;
  const lines = [{ key: metric, label }];
  return (
    <AnalyticsChartCard title="Platform Growth" description="Consumer-account creation, business creation, and first recorded business approvals."
      {...state} controls={<><AnalyticsMetricSelector label="Growth metric" value={metric} onChange={setMetric} options={OPTIONS} /><AnalyticsIntervalControl value={interval} onChange={setInterval} /></>}
      summaryContent={<AnalyticsSummary items={[{ label: `${label} in selected period`, value: formatCount(activity?.value), context: comparisonText(activity?.change) }, ...(activity?.change?.value != null ? [{ label: "Previous period", value: formatCount(activity.previous_value) }] : [])]} />}
      summary={activity?.value === 0 ? "No selected acquisition events were recorded during this period." : "Accounts exclude staff/Admin roles using current roles. Approvals are first recorded decisions currently linked to a business."}
      accessibleData={<AnalyticsSeriesValues title="Platform growth" rows={data?.series} lines={lines} />}
      footer={<AnalyticsReportContext meta={data?.meta} />}
    >
      {/* Selected metric shares the report's existing bucket positions */}
      <AnalyticsTimeSeries rows={data?.series} lines={lines} />
    </AnalyticsChartCard>
  );
}
