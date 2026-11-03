import { REPORT_REASONS } from "../../reported-reviews/utils/reportedReviewPresentation";
import ReviewDate from "./ReviewDate";
import ReviewStateBadge from "./ReviewStateBadge";

/** Inspect retained report reasons and decisions without inferring reporter identities. */
export default function AllReviewReports({ review }) {
  return (
    <section
      aria-label="Review reports"
      className="border-t border-stroke pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          Reports ({review.report_count})
        </h3>
        <p className="text-xs text-text-secondary">
          {review.pending_report_count} pending
        </p>
      </div>
      {(review.reports ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">
          No reports have been retained for this review.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-text-secondary">
            Includes resolved and withdrawn reports.
          </p>
          <ul className="mt-3 divide-y divide-stroke">
            {review.reports.map((report) => {
              return (
                <li key={report.id} className="space-y-3 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-text-primary">
                      {REPORT_REASONS[report.type] || "Reason not recorded"}
                    </h4>
                    <ReviewStateBadge status={report.status} report />
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <div>
                      <p className="mb-1 text-xs text-text-secondary">
                        Reported
                      </p>
                      <ReviewDate value={report.created_at} />
                    </div>
                    {report.updated_at &&
                      report.updated_at !== report.created_at && (
                        <div>
                          <p className="mb-1 text-xs text-text-secondary">
                            Updated
                          </p>
                          <ReviewDate value={report.updated_at} />
                        </div>
                      )}
                    {report.withdrawn_at && (
                      <div>
                        <p className="mb-1 text-xs text-text-secondary">
                          Withdrawn
                        </p>
                        <ReviewDate value={report.withdrawn_at} />
                      </div>
                    )}
                  </div>
                  {report.explanation && (
                    <div>
                      <p className="text-xs font-medium text-text-secondary">
                        Explanation
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-primary">
                        {report.explanation}
                      </p>
                    </div>
                  )}
                  {report.admin_notes && (
                    <div>
                      <p className="text-xs font-medium text-text-secondary">
                        Administrator notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-primary">
                        {report.admin_notes}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
