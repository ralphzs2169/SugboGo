import { Flag } from "lucide-react";

import { formatLabel } from "@/shared/utils/stringUtils";

/**
 * Displays explorer report activity for the disputed review
 * using a compact total and reason breakdown.
 */
export default function ReviewDisputeReports({ review }) {
  const reportSummary = review?.report_summary ?? [];

  const totalReports =
    review?.report_count ??
    reportSummary.reduce((sum, report) => sum + report.count, 0);

  return (
    <div className="border-t border-stroke p-6">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <Flag className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} />

        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Explorer Reports
        </h2>
      </div>

      {totalReports > 0 ? (
        <div className="mt-5">
          {/* Report summary */}
          <div className="flex items-end justify-between border-b border-stroke pb-4">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                Total Reports
              </p>

              <p className="mt-1 text-2xl font-bold leading-none text-text-primary">
                {totalReports}
              </p>
            </div>

            <Flag className="h-4 w-4 text-text-secondary" strokeWidth={1.75} />
          </div>

          {/* Report breakdown */}
          {reportSummary.length > 0 && (
            <div className="mt-4">
              <p className="mb-2.5 text-xs font-semibold text-text-secondary">
                Report Reasons
              </p>

              <div className="space-y-1">
                {reportSummary.map((report) => (
                  <div
                    key={report.reason}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-secondary" />

                      <span className="truncate text-sm text-text-primary">
                        {formatLabel(report.reason)}
                      </span>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-text-secondary">
                      {report.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty report state */
        <div className="mt-5 flex flex-col items-center px-5 py-6 text-center">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-secondary">
            <Flag className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </div>

          <p className="text-sm font-medium text-text-primary">
            No explorer reports
          </p>

          <p className="mt-0.5 text-xs leading-5 text-text-secondary">
            This review has not been reported by any explorer.
          </p>
        </div>
      )}
    </div>
  );
}
