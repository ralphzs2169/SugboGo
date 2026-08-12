import { AlertTriangle, Info } from "lucide-react";

/**
 * Displays section-specific administrator feedback.
 *
 * Previous rejection feedback is presented as informational context
 * when reviewing a resubmitted application, while active rejection
 * feedback is presented as a requested change.
 */
export default function ApplicationReviewFeedback({
  feedback,
  isResubmission = false,
}) {
  if (!feedback?.message) {
    return null;
  }

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${
        isResubmission
          ? "border-info/20 bg-info/5"
          : "border-danger/20 bg-danger/5"
      }`}
    >
      <div className="flex items-start gap-3">
        {isResubmission ? (
          <Info
            size={18}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-info"
          />
        ) : (
          <AlertTriangle
            size={18}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-danger"
          />
        )}

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">
            {isResubmission ? "Previous Review Feedback" : "Changes Requested"}
          </h3>

          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
            {feedback.message}
          </p>
        </div>
      </div>
    </div>
  );
}
