import { ChevronDown, Clock3 } from "lucide-react";
import { useState } from "react";

/**
 * Displays the application review SLA and explains the meaning of
 * each queue status. The information can be minimized and expanded
 * without removing the SLA guidance from the page.
 */
export default function ApplicationReviewSlaInfo({
  slaBusinessDays,
  approachingBusinessDays,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (
    slaBusinessDays === null ||
    slaBusinessDays === undefined ||
    approachingBusinessDays === null ||
    approachingBusinessDays === undefined
  ) {
    return null;
  }

  const onTimeEnd = approachingBusinessDays - 1;
  const approachingEnd = slaBusinessDays - 1;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-info/20 bg-info/5">
      {/* SLA header */}
      <button
        type="button"
        onClick={() => setIsExpanded((previous) => !previous)}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-info/5 sm:px-5"
        aria-expanded={isExpanded}
      >
        <div className="shrink-0 rounded-lg bg-info/10 p-2 text-info">
          <Clock3 size={18} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary">
            Application Review SLA
          </h2>

          {!isExpanded && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Review within {slaBusinessDays} business days
            </p>
          )}
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 text-text-secondary transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* SLA details */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-info/10 px-4 pb-5 pt-4 sm:px-5">
            <p className="text-sm leading-6 text-text-secondary">
              The Service Level Agreement (SLA) sets the target for reviewing
              applications within{" "}
              <span className="font-semibold text-text-primary">
                {slaBusinessDays} business days
              </span>{" "}
              of submission.
            </p>

            {/* Status thresholds */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-success" />

                <span className="font-medium text-text-primary">On time</span>

                <span className="text-text-secondary">
                  0–{onTimeEnd} business days
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />

                <span className="font-medium text-text-primary">
                  Approaching
                </span>

                <span className="text-text-secondary">
                  {approachingBusinessDays}–{approachingEnd} business days
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />

                <span className="font-medium text-text-primary">Overdue</span>

                <span className="text-text-secondary">
                  {slaBusinessDays}+ business days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
