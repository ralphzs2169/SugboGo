import MetricCard from "@/features/admin-panel/components/MetricCard";

/**
 * Displays the primary business-management KPIs for administrators.
 *
 * Uses static values for the initial management-page implementation.
 */
export default function BusinessMetrics() {
  return (
    <div className="mb-0 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Total businesses KPI */}
      <MetricCard
        title="Total Businesses"
        value="248"
        footerValue="+18 this month"
      />

      {/* Active businesses KPI */}
      <MetricCard
        title="Active Businesses"
        value="241"
        footerValue="97.2% of total"
      />

      {/* Suspended businesses KPI */}
      <MetricCard
        title="Suspended Businesses"
        value="7"
        footerValue="2.8% of total"
      />

      {/* Top business KPI */}
      <MetricCard
        title="Top Business"
        value="Sugbo Bistro"
        footerValue="Most discovered"
      />
    </div>
  );
}
