import { ArrowRight, History } from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "@/shared/components/StatusBadge";
import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../constants/reviewDisputeStatus";
import { formatLabel } from "@/shared/utils/stringUtils";
import { formatDateTime } from "@/shared/utils/dateUtils";

/**
 * Keeps the previous-disputes section visible for every case, showing either
 * compact historical records or a small first-attempt empty state.
 */
export default function ReviewDisputeHistory({
  previousDisputes = [],
  currentAttempt = 1,
}) {
  return (
    <section>
      {/* Section heading */}
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Previous Disputes
        </h2>

        <span className="text-xs text-text-secondary">
          · {previousDisputes.length}
        </span>
      </div>

      {previousDisputes.length === 0 ? (
        /* Empty state */
        <div className="flex items-center gap-3 rounded-xl border border-stroke bg-background px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary">
            <History className="h-4 w-4" aria-hidden="true" />
          </div>

          <div>
            <p className="text-sm font-medium text-text-primary">
              No previous dispute attempts.
            </p>

            <p className="mt-0.5 text-xs text-text-secondary">
              This is the first dispute attempt for this review.
            </p>
          </div>
        </div>
      ) : (
        /* Previous dispute attempts */
        <div className="overflow-hidden rounded-xl border border-stroke bg-background">
          {previousDisputes.map((attempt, index) => {
            const attemptNumber = currentAttempt - index - 1;

            return (
              <div
                key={attempt.id}
                className="flex items-center justify-between gap-5 border-b border-stroke px-5 py-4 last:border-b-0"
              >
                {/* Attempt information */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-semibold text-text-primary">
                      Attempt #{attemptNumber}
                    </span>

                    <StatusBadge
                      variant={
                        REVIEW_DISPUTE_STATUS_BADGE_VARIANT[attempt.status] ||
                        "neutral"
                      }
                    >
                      {formatLabel(attempt.status)}
                    </StatusBadge>
                  </div>

                  <p className="mt-1.5 truncate text-sm font-medium capitalize text-text-primary">
                    {formatLabel(attempt.reason)}
                  </p>

                  <p className="mt-0.5 text-xs text-text-secondary">
                    Filed {formatDateTime(attempt.created_at)}
                  </p>
                </div>

                {/* Historical dispute navigation */}
                <Link
                  to={`/admin-panel/review-disputes/${attempt.id}`}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary transition-opacity hover:opacity-80"
                >
                  View dispute
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
