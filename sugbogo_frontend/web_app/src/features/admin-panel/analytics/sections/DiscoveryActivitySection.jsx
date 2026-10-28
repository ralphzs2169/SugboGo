import { useState } from "react";
import { useDiscoveryTrend } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsChartCard from "../components/AnalyticsChartCard";
import AnalyticsMetricSelector from "../components/AnalyticsMetricSelector";
import AnalyticsIntervalControl from "../components/AnalyticsIntervalControl";
import AnalyticsTimeSeries, { AnalyticsSeriesValues } from "../components/AnalyticsTimeSeries";
import AnalyticsReportContext, { AnalyticsSummary } from "../components/AnalyticsReportContext";
import { comparisonText, formatCount } from "../utils/presentation";

const OPTIONS = [{ value: "profile_visits", label: "Profile visits" }, { value: "impressions", label: "Impressions" }, { value: "saves", label: "Saves" }];

/** Reports recorded discovery observations with source outages isolated from SQL-backed sections. */
export default function DiscoveryActivitySection({ period }) {
  const [metric, setMetric] = useState("profile_visits");
  const [interval, setInterval] = useState("daily");
  const query = useDiscoveryTrend({ ...period, metric, interval });
  const state = useAnalyticsSectionState(query, "discovery", "discovery activity");
  const data = query.data;
  const lines = [{ key: "value", label: data?.label ?? OPTIONS.find((option) => option.value === metric).label, color: "var(--color-info)" }];
  return (
    <AnalyticsChartCard title="Discovery Activity" description="Recorded profile visits, impressions, and saves." {...state}
      controls={<><AnalyticsMetricSelector label="Discovery metric" value={metric} onChange={setMetric} options={OPTIONS} /><AnalyticsIntervalControl value={interval} onChange={setInterval} /></>}
      unavailable={Boolean(data && data.value === null && data.series === null)} unavailableMessage="Discovery activity is currently unavailable. Other analytics reports remain usable."
      partialNotice={data?.meta?.is_partial ? "Tracking coverage is unverified or incomplete. Recorded zeroes do not establish absence of exposure; comparisons may be unavailable." : null}
      summaryContent={<AnalyticsSummary items={[{ label: "Selected-period observations", value: formatCount(data?.value), context: comparisonText(data?.change) }, ...(data?.change?.value != null ? [{ label: "Previous period", value: formatCount(data.previous_value) }] : [])]} />}
      accessibleData={<AnalyticsSeriesValues title="Discovery activity" rows={data?.series ?? []} lines={lines} />}
      footer={<AnalyticsReportContext meta={data?.meta}><p>{data?.description}</p><p>Sparse buckets retain their dates. No line is drawn across missing observations. Coverage limitations can suppress comparisons.</p></AnalyticsReportContext>}
    >
      {/* One server-selected visibility metric */}
      <AnalyticsTimeSeries rows={data?.series ?? []} lines={lines} />
    </AnalyticsChartCard>
  );
}
