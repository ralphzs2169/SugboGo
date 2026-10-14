import { ChevronRight, History } from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { formatLabel } from "@/shared/utils/stringUtils";

import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../constants/reviewDisputeStatus";

/**
 * Displays previous dispute attempts in a structured history list, with
 * status context and navigation to each historical dispute record.
 */
export default function ReviewDisputeHistory({
  previousDisputes = [],
  currentAttempt = 1,
}) {
  return (
    <section
      aria-label="Previous dispute attempts"
      className="border-t border-stroke pt-5"
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History
            className="h-4 w-4 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <h2 className="text-base font-semibold text-text-primary">
            Previous Disputes
          </h2>
        </div>

        <span className="shrink-0 text-xs font-medium text-text-secondary">
          {previousDisputes.length}{" "}
          {previousDisputes.length === 1 ? "attempt" : "attempts"}
        </span>
      </div>

      {previousDisputes.length === 0 ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              No previous dispute attempts.
            </p>

            <p className="mt-0.5 text-xs text-text-secondary">
              This is the first dispute attempt for this review.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-stroke border-t border-stroke">
          {previousDisputes.map((attempt, index) => {
            const attemptNumber = currentAttempt - index - 1;

            return (
              <div
                key={attempt.id}
                className="
                  flex items-center justify-between
                  gap-5 py-3.5
                "
              >
                {/* Attempt information */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      Attempt #{attemptNumber}
                    </span>

                    <StatusBadge
                      variant={
                        REVIEW_DISPUTE_STATUS_BADGE_VARIANT[attempt.status] ||
                        "mutedSoft"
                      }
                    >
                      {formatLabel(attempt.status)}
                    </StatusBadge>
                  </div>

                  <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                    {formatLabel(attempt.reason)}
                  </p>

                  {attempt.created_at && (
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Filed {formatDateTime(attempt.created_at)}
                    </p>
                  )}
                </div>

                {/* Historical dispute navigation */}
                <Link
                  to={`/admin-panel/moderation-integrity?tab=disputes&dispute_id=${attempt.id}`}
                  aria-label={`View dispute attempt ${attemptNumber}`}
                  className="
                    group flex shrink-0 items-center gap-1
                    rounded-sm text-xs font-medium text-primary
                    transition-colors hover:underline
                    focus-visible:outline focus-visible:outline-2
                    focus-visible:outline-offset-2
                    focus-visible:outline-primary
                  "
                >
                  View dispute
                  <ChevronRight
                    className="
                      h-3.5 w-3.5 transition-transform
                      group-hover:translate-x-0.5
                    "
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
