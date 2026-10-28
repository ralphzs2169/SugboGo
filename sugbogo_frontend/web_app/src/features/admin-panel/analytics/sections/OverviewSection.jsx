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
    <AnalyticsSection framed={false} title="Overview" {...state}
      partialNotice={data?.meta?.is_partial ? "Inventory is current state; recorded discovery coverage may be incomplete. Discovery-active accounts are not general platform MAU." : null}
      footer={<AnalyticsReportContext meta={data?.meta} />}
    >
      {/* Backend-labelled inventory and period populations */}
      <AnalyticsMetricGrid>
        {METRICS.map((key) => {
          const metric = data?.kpis?.[key];
          const label = key === "new_explorer_accounts" ? "New Explorer accounts" : key === "discovery_active_explorers" ? "Discovery-active accounts" : metric?.label ?? key.replaceAll("_", " ");
          const definition = key === "new_explorer_accounts" ? "Accounts created during the selected period whose current role is Explorer. Later promotion to Merchant can revise this cohort." : key === "discovery_active_explorers" ? "Recorded discovery-active accounts include eligible Explorer and Merchant actors. This is not general platform MAU." : null;
          return <AnalyticsMetricCard compact key={key} label={label} value={metric?.value} formatValue={formatCount}
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
