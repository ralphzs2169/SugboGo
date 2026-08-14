import { Check, RefreshCw } from "lucide-react";

/**
 * Displays the relevant change status for a section of a resubmitted
 * application, distinguishing addressed requested changes from other
 * updates made since the previous review.
 */
export default function ApplicationReviewChangeStatus({
  feedback,
  isChangedSinceLastReview = false,
  isResubmission = false,
}) {
  if (!isResubmission || !isChangedSinceLastReview) {
    return null;
  }

  const hasRequestedChange = Boolean(feedback?.message);

  const statusClasses = hasRequestedChange
    ? "border-success/20 bg-success/5 text-success"
    : "border-info/20 bg-info/5 text-info";

  return (
    <div
      className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 ${statusClasses}`}
    >
      {hasRequestedChange ? (
        <Check size={16} strokeWidth={2.5} className="shrink-0 text-success" />
      ) : (
        <RefreshCw size={16} strokeWidth={2.5} className="shrink-0 text-info" />
      )}

      <span
        className={`text-xs font-semibold ${
          hasRequestedChange ? "text-success" : "text-info"
        }`}
      >
        {hasRequestedChange
          ? "Required change addressed"
          : "Updated since last review"}
      </span>
    </div>
  );
}
