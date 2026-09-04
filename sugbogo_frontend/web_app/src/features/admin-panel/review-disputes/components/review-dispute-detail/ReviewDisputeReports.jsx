import { Flag, Info } from "lucide-react";

function formatLabel(value) {
  if (!value) {
    return "Unknown";
  }

  return value.replaceAll("_", " ");
}

/**
 * Displays explorer reports associated with the disputed review,
 * including the total count and breakdown by report reason.
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
        <div className="mt-5 space-y-4">
          {/* Report total */}
          <div className="flex items-center justify-between rounded-lg border border-stroke bg-surface-secondary px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                Total Reports
              </p>

              <p className="mt-0.5 text-lg font-bold text-text-primary">
                {totalReports}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background">
              <Flag
                className="h-4 w-4 text-text-secondary"
                strokeWidth={1.75}
              />
            </div>
          </div>

          {/* Report breakdown */}
          {reportSummary.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold text-text-secondary">
                Report Reasons
              </p>

              <div className="divide-y divide-stroke rounded-lg border border-stroke">
                {reportSummary.map((report) => (
                  <div
                    key={report.reason}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-secondary" />

                      <span className="truncate text-sm capitalize text-text-primary">
                        {formatLabel(report.reason)}
                      </span>
                    </div>

                    <span className="shrink-0 rounded-md bg-surface-secondary px-2 py-0.5 text-xs font-semibold text-text-secondary">
                      {report.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="mt-5 rounded-lg border border-dashed border-stroke px-4 py-6 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface-secondary">
            <Info className="h-4 w-4 text-text-secondary" strokeWidth={1.75} />
          </div>

          <p className="mt-3 text-sm font-medium text-text-primary">
            No explorer reports
          </p>

          <p className="mt-1 text-xs text-text-secondary">
            This review has not been reported by any explorer.
          </p>
        </div>
      )}
    </div>
  );
}
