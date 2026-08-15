import React from "react";
import MetricCard from "@/features/admin-panel/components/MetricCard";

/**
 * Displays cluster and category management KPIs for administrators.
 *
 * Highlights the current classification structure and recent additions.
 */
export default function ClusterCategoryMetrics({
  totalClusters,
  clustersCreatedThisWeek,
  totalCategories,
  categoriesCreatedThisWeek,
  isError = false,
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total clusters KPI */}
      <MetricCard
        title="Total Clusters"
        value={isError ? "—" : (totalClusters ?? "—")}
        footerValue={
          isError
            ? "Unable to load"
            : clustersCreatedThisWeek
              ? `+${clustersCreatedThisWeek} this week`
              : "0 this week"
        }
      />

      {/* Total categories KPI */}
      <MetricCard
        title="Total Categories"
        value={isError ? "—" : (totalCategories ?? "—")}
        footerValue={
          isError
            ? "Unable to load"
            : categoriesCreatedThisWeek
              ? `+${categoriesCreatedThisWeek} this week`
              : "0 this week"
        }
      />

      <MetricCard
        title="Most Used Cluster"
        value="Food & Beverage"
        footerValue="used in 12 businesses"
      />

      <MetricCard
        title="Most Used Category"
        value="Restaurant"
        footerValue="used in 34 businesses"
      />
    </div>
  );
}
