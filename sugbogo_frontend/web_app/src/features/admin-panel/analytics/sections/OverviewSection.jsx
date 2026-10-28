import { usePlatformAnalytics } from "../hooks/useAnalyticsReports";
import useAnalyticsSectionState from "../hooks/useAnalyticsSectionState";
import AnalyticsSection from "../components/AnalyticsSection";
import AnalyticsMetricGrid from "../components/AnalyticsMetricGrid";
import AnalyticsMetricCard from "../components/AnalyticsMetricCard";
import AnalyticsReportContext from "../components/AnalyticsReportContext";
import { formatCount } from "../utils/presentation";

const METRICS = ["active_businesses", "approved_businesses", "new_explorer_accounts", "discovery_active_explorers"];

/** Separates current inventory from current-role acquisition and recorded discovery activity. */
export default function OverviewSection({ period }) {
  const query = usePlatformAnalytics(period);
  const state = useAnalyticsSectionState(query, "overview", "platform overview");
  const data = query.data;
  return (
    <AnalyticsSection framed={false} compactHeader title="Overview" {...state}
      footer={<AnalyticsReportContext fullTimestamp meta={data?.meta} />}
    >
      {data?.meta?.is_partial && <p className="mb-3 text-xs text-text-secondary">Inventory reflects current status. Recorded discovery activity may be incomplete.</p>}
      {/* Backend-labelled inventory and period populations */}
      <AnalyticsMetricGrid>
        {METRICS.map((key) => {
          const metric = data?.kpis?.[key];
          const label = key === "new_explorer_accounts" ? "New Explorer accounts" : key === "discovery_active_explorers" ? "Discovery-active accounts" : metric?.label ?? key.replaceAll("_", " ");
          const definition = key === "new_explorer_accounts" ? "New accounts whose role is Explorer today, including all account statuses. Accounts that later become Merchants no longer appear in this count." : key === "discovery_active_explorers" ? "Distinct accounts with recorded discovery activity, including Explorer and Merchant accounts. This is not app-wide active use." : null;
          return <AnalyticsMetricCard compact dense key={key} label={label} value={metric?.value} formatValue={formatCount}
            details={definition}
            measurementType={metric?.measurement_type} context={metric?.description}
            measurementLabel={metric?.measurement_type === "current_snapshot" ? "Current snapshot" : period.period === "custom" ? "Selected dates" : `Last ${period.period} days`}
            comparison={metric?.measurement_type === "current_snapshot" ? undefined : metric?.change}
            unavailableMessage={metric?.source === "visibility" ? "Recorded visibility activity is unavailable." : undefined} />;
        })}
      </AnalyticsMetricGrid>
    </AnalyticsSection>
  );
}
