import { Bookmark, Eye, MessageSquare, ShieldCheck } from "lucide-react";

import MetricCard from "@/features/admin-panel/components/MetricCard";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

/**
 * Displays the key explorer engagement signals for a business.
 *
 * Shows community vouches with their specialty breakdown, received reviews,
 * explorer saves, and business visits.
 */
export default function BusinessDetailMetrics({
  vouchCount = 0,
  reviewCount = 0,
  pocketCount = 0,
  specialtyTags = [],
}) {
  const vouchBreakdown = (
    <div className="flex max-w-[180px] flex-col items-end gap-1.5">
      {specialtyTags.slice(0, 3).map((tag) => (
        <SpecialtyTagChip
          key={tag.id}
          tag={tag}
          size="small"
          vouchCount={tag.vouch_count}
        />
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Vouches */}
      <MetricCard
        title="Vouches"
        value={vouchCount}
        footerValue="Community trust"
        icon={ShieldCheck}
        visualization={vouchBreakdown}
      />

      {/* Reviews */}
      <MetricCard
        title="Reviews"
        value={reviewCount}
        footerValue="Explorer feedback"
        icon={MessageSquare}
      />

      {/* Saves */}
      <MetricCard
        title="Saves"
        value={pocketCount}
        footerValue="Saved by explorers"
        icon={Bookmark}
      />

      {/* Visits */}
      <MetricCard
        title="Visits"
        value="—"
        footerValue="Coming soon"
        icon={Eye}
      />
    </div>
  );
}
