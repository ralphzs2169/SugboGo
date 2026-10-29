import { useDiscoveryScoreAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsReportContext, { AnalyticsDrilldown, AnalyticsSummary } from "../components/AnalyticsReportContext";
import { formatCount } from "../utils/presentation";

/** Reads coverage counters from one minimal score-list request without duplicating its management page. */
export default function DiscoveryScoreHealthSection() {
  const query = useDiscoveryScoreAnalytics({ page_size: 1 });
  const state = useAnalyticsSectionState(query, "score-health", "Discovery Score health");
  const coverage = query.data?.coverage;
  return (
    <AnalyticsSection title="Discovery Score Health" description="Current active-business score coverage." {...state}
      action={<AnalyticsDrilldown to="/admin-panel/analytics/discovery-scores">View Discovery Scores</AnalyticsDrilldown>}
      footer={<AnalyticsReportContext asOf={coverage?.snapshot_at}><p>A business can appear in more than one status, so these counts should not be added together. Freshness threshold: {formatCount(coverage?.max_score_age_hours)} hours. A recently calculated score does not confirm that all discovery activity was recorded.</p></AnalyticsReportContext>}
    >
      {/* Coverage uses global counters, never the single returned score row */}
      <AnalyticsSummary compact items={[["fresh", "Fresh"], ["stale", "Stale"], ["pending", "Pending"], ["failed", "Failed"]].map(([key, label]) => ({ label, value: formatCount(coverage?.[key]) }))} />
      <p className="text-xs text-text-secondary">Missing {formatCount(coverage?.missing)} · Provisional {formatCount(coverage?.provisional)}</p>
    </AnalyticsSection>
  );
}
