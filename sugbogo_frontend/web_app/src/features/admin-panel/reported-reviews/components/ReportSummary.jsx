import { AlertTriangle, Flag } from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";
import { REPORT_REASONS } from "../utils/reportedReviewPresentation";

function ReportSummary({ review }) {
  const reasons = Object.entries(REPORT_REASONS);

  const showSingleReportTime =
    review.pending_report_count === 1 ||
    review.first_pending_at === review.latest_pending_at;

  return (
    <section
      aria-label="Community report summary"
      className="border-t border-stroke pt-5"
    >
      <div className="flex items-center gap-2">
        <Flag
          className="h-4 w-4 text-text-secondary"
          strokeWidth={1.75}
          aria-hidden="true"
        />

        <h3 className="text-base font-semibold text-text-primary">
          Community Reports
        </h3>
      </div>

      <p className="mt-1 text-sm text-text-secondary">
        {review.pending_report_count} pending{" "}
        {review.pending_report_count === 1 ? "report" : "reports"}. Community
        reports are supporting evidence for your decision.
      </p>

      {/* Only show when the attention threshold is reached */}
      {review.needs_attention && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              Elevated report activity
            </p>

            <p className="mt-0.5 text-xs text-text-secondary">
              This review has reached the community report attention threshold.
            </p>
          </div>
        </div>
      )}

      {/* Reason breakdown */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {reasons.map(([reason, label]) => {
          const count = review.reason_counts?.[reason] ?? 0;
          const hasReports = count > 0;

          return (
            <div
              key={reason}
              className={`rounded-lg border px-3 py-3 ${
                hasReports
                  ? "border-stroke bg-surface"
                  : "border-stroke bg-surface-muted/50"
              }`}
            >
              <dt
                className={`text-xs ${
                  hasReports
                    ? "font-medium text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                {label}
              </dt>

              <dd
                className={`mt-1 ${
                  hasReports
                    ? "text-lg font-semibold text-text-primary"
                    : "text-base font-medium text-text-secondary"
                }`}
              >
                {count}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Report timing */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary">
        {showSingleReportTime ? (
          <p>Reported {formatDateTime(review.latest_pending_at)}</p>
        ) : (
          <>
            <p>First report: {formatDateTime(review.first_pending_at)}</p>

            <p>Latest report: {formatDateTime(review.latest_pending_at)}</p>
          </>
        )}
      </div>
    </section>
  );
}

export default ReportSummary;
