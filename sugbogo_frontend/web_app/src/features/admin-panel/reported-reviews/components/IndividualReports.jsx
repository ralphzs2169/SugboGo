import { useState } from "react";
import { ChevronDown, ClipboardList, History } from "lucide-react";

import ReportRow from "./ReportRow";

function IndividualReports({ review }) {
  const [showPrevious, setShowPrevious] = useState(false);

  const reports = review.reports ?? [];
  const pending = reports.filter((report) => report.status === "pending");
  const resolved = reports.filter((report) => report.status !== "pending");

  return (
    <section
      aria-label="Individual reports"
      className="border-t border-stroke pt-5"
    >
      {/* Section heading */}
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList
            className="h-4 w-4 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <h3 className="text-base font-semibold text-text-primary">
            Individual Reports
          </h3>
        </div>

        <p className="mt-1 text-sm text-text-secondary">
          Community reports submitted about this review.
        </p>
      </div>
      {/* Pending reports */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Pending reports
          </h4>

          <span className="text-xs font-medium text-text-secondary">
            {pending.length}
          </span>
        </div>

        {pending.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-stroke bg-background">
            <div className="divide-y divide-stroke">
              {pending.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-stroke bg-surface-muted/50 px-4 py-3">
            <p className="text-sm text-text-secondary">
              No pending reports remain for this review.
            </p>
          </div>
        )}
      </div>

      {/* Previous decisions */}
      {resolved.length > 0 && (
        <div className="mt-4 border-t border-stroke pt-3">
          <button
            type="button"
            aria-expanded={showPrevious}
            aria-controls="previous-report-decisions"
            onClick={() => setShowPrevious((value) => !value)}
            className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-interaction-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex min-w-0 items-center gap-2">
              <History
                className="h-4 w-4 shrink-0 text-text-secondary"
                aria-hidden="true"
              />

              <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary">
                Previous decisions
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-text-secondary">
                {resolved.length}
              </span>

              <ChevronDown
                className={`h-4 w-4 text-text-secondary transition-transform ${
                  showPrevious ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </span>
          </button>

          {showPrevious && (
            <div
              id="previous-report-decisions"
              className="mt-2 overflow-hidden rounded-lg border border-stroke bg-surface-muted/30"
            >
              <div className="divide-y divide-stroke">
                {resolved.map((report) => (
                  <ReportRow key={report.id} report={report} resolved />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default IndividualReports;
