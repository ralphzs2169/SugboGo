import { pendingReasons, REPORT_REASONS } from "../utils/reportedReviewPresentation";

function ReasonBadges({ counts }) {
  const reasons = pendingReasons(counts).sort(
    ([first], [second]) => (counts[second] ?? 0) - (counts[first] ?? 0),
  );
  const visibleReasons = reasons.length > 3 ? reasons.slice(0, 2) : reasons;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleReasons.map(([reason]) => (
        <span key={reason} className="inline-flex items-center rounded-lg border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
          {REPORT_REASONS[reason]}
        </span>
      ))}
      {reasons.length > 3 && (
        <span className="inline-flex items-center rounded-lg border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
          +{reasons.length - visibleReasons.length} more
        </span>
      )}
    </div>
  );
}

export default ReasonBadges;
