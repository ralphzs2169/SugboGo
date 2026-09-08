import {
  Calendar,
  Clock,
  ExternalLink,
  History,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import ApplicationQueueStatus from "../../../business-applications/components/ApplicationQueueStatus";
import { formatApplicationDate } from "../../../business-applications/utils/applicationReview.utils";
import { formatLabel } from "@/shared/utils/stringUtils";
/**
 * Displays a compact summary of the application associated with an
 * already-registered business.
 *
 * Provides the authorized representative, application dates, processing
 * status, submission history, and direct access to the complete application.
 */
export default function BusinessApplicationSummary({ application }) {
  const navigate = useNavigate();

  if (!application) {
    return null;
  }

  const submissionCount = application.submission_count ?? 0;
  const identity = application.identity;

  function handleViewApplication() {
    navigate(`/admin-panel/business/application/${application.id}`);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Application Summary
          </h2>
        </div>

        <span className="text-xs font-medium text-text-secondary">
          #{application.id}
        </span>
      </div>

      {/* Application summary */}
      <div className="p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Authorized representative */}
          <div className="flex min-w-0 items-start gap-3">
            <UserRound
              size={18}
              strokeWidth={2}
              className="shrink-0 text-text-secondary"
            />

            <div className="min-w-0">
              <p className="text-xs font-medium text-text-secondary">
                Authorized Representative
              </p>

              <p
                className="mt-1 truncate text-sm font-medium text-text-primary"
                title={identity?.representative_name || ""}
              >
                {identity?.representative_name || "—"}
              </p>

              {identity?.representative_role && (
                <p
                  className="mt-0.5 truncate text-xs text-text-secondary"
                  title={identity.representative_role}
                >
                  {formatLabel(identity.representative_role)}
                </p>
              )}
            </div>
          </div>

          {/* Submitted */}
          <div className="flex items-start gap-3">
            <Calendar
              size={18}
              strokeWidth={2}
              className="shrink-0 text-text-secondary"
            />

            <div>
              <p className="text-xs font-medium text-text-secondary">
                Submitted
              </p>

              <p className="mt-1 text-sm font-medium text-text-primary">
                {formatApplicationDate(application.submitted_at)}
              </p>
            </div>
          </div>

          {/* Reviewed and processing status */}
          <div className="flex items-start gap-3">
            <History
              size={18}
              strokeWidth={2}
              className="shrink-0 text-text-secondary"
            />

            <div className="min-w-0">
              <p className="text-xs font-medium text-text-secondary">
                Reviewed
              </p>

              <p className="mt-1 text-sm font-medium text-text-primary">
                {formatApplicationDate(application.reviewed_at)}
              </p>

              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-text-secondary">
                  Resolved in{" "}
                </span>

                <ApplicationQueueStatus
                  submittedAt={application.submitted_at}
                  resolvedAt={application.reviewed_at}
                  days={application.time_in_queue_business_days}
                  status={application.queue_status}
                  compact
                />
              </div>
            </div>
          </div>

          {/* Submission count */}
          <div className="flex items-start gap-3">
            <History
              size={18}
              strokeWidth={2}
              className="shrink-0 text-text-secondary"
            />

            <div>
              <p className="text-xs font-medium text-text-secondary">
                Submissions
              </p>

              <p className="mt-1 text-sm font-semibold text-text-primary">
                {submissionCount}{" "}
                <span className="font-normal text-text-secondary">
                  {submissionCount === 1 ? "attempt" : "attempts"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Application action */}
        <div className="mt-5 flex justify-end border-t border-stroke pt-4">
          <button
            type="button"
            onClick={handleViewApplication}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-stroke/50"
          >
            View Full Application
            <ExternalLink size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  );
}
