import { Heart, Tag, Tags, TrendingUp } from "lucide-react";

import MetricCard from "@/features/admin-panel/components/MetricCard";

/**
 * Displays specialty-tag management KPIs for administrators.
 *
 * Highlights the current tag inventory and usage across businesses
 * and explorer engagement.
 */
export default function SpecialtyTagMetrics({ totalTags }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Total specialty tags KPI */}
      <MetricCard
        title="Total Specialty Tags"
        icon={Tags}
        value={totalTags}
        footerValue="Across all specialty tags"
      />

      {/* Most used tag KPI */}
      <MetricCard
        title="Most Used Tag"
        icon={TrendingUp}
        value="—"
        footerValue="Business usage"
      />

      {/* Most vouched tag KPI */}
      <MetricCard
        title="Most Vouched Tag"
        icon={Heart}
        value="—"
        footerValue="Explorer vouches"
      />

      {/* Least used tag KPI */}
      <MetricCard
        title="Least Used Tag"
        icon={Tag}
        value="—"
        footerValue="Business usage"
      />
    </div>
  );
}
