import { Bookmark, MessageSquare, ShieldCheck } from "lucide-react";

import MetricCard from "@/features/admin-panel/components/MetricCard";

/**
 * Displays the key explorer engagement signals for a business.
 *
 * Shows community vouches, received reviews, and explorer saves.
 */
export default function BusinessDetailMetrics({
  vouchCount = 0,
  reviewCount = 0,
  pocketCount = 0,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Vouches */}
      <MetricCard
        title="Vouches"
        value={vouchCount}
        footerValue="Community trust"
        icon={ShieldCheck}
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
    </div>
  );
}
