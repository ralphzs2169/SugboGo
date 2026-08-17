import MetricCard from "@/features/admin-panel/components/MetricCard";

/**
 * Displays the primary business-management KPIs for administrators.
 *
 * Uses the current business totals and a compact distribution visualization
 * to provide immediate context around the active business population.
 */
export default function BusinessMetrics() {
  const businessGrowthData = [
    { date: "2026-07-06", value: 221 },
    { date: "2026-07-13", value: 225 },
    { date: "2026-07-20", value: 229 },
    { date: "2026-07-27", value: 232 },
    { date: "2026-08-03", value: 238 },
    { date: "2026-08-10", value: 244 },
    { date: "2026-08-17", value: 248 },
  ];

  return (
    <div className="mb-0 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Total businesses KPI */}
      <MetricCard
        title="Total Businesses"
        value="248"
        trend={{
          direction: "up",
          value: "7.8%",
          variant: "success",
        }}
        footerLabel="vs last month"
        sparklineData={businessGrowthData}
      />

      {/* Active businesses KPI */}
      <MetricCard
        title="Active Businesses"
        value="241"
        footerValue="97.2% of total"
        distribution={{
          data: [
            { name: "Active", value: 241 },
            { name: "Suspended", value: 7 },
          ],
        }}
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
