import { Calendar, Contact, Clock, User, Mail, History } from "lucide-react";
import UserAvatar from "@/shared/components/UserAvatar";
import StatusBadge from "@/shared/components/StatusBadge";
import statusConfig from "../../config/applicationStatus.config";
import ApplicationQueueStatus from "../../components/ApplicationQueueStatus";

import {
  formatApplicationDate,
  formatApplicationElapsedTime,
  isApplicationResolved,
} from "../utils/applicationReviewUtils";

const statusAccents = {
  draft: "bg-stroke",
  submitted: "bg-info",
  rejected: "bg-danger",
  approved: "bg-success",
};

/**
 * Displays a single application metadata item with an icon, label, and value.
 */
function MetaItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        size={18}
        strokeWidth={2}
        className="shrink-0 text-text-secondary"
      />

      <div>
        <p className="text-xs font-medium text-text-secondary">{label}</p>

        <div className="mt-1">{value}</div>
      </div>
    </div>
  );
}

/**
 * Displays the identity, current status, and key timing information
 * for the business application being reviewed.
 */

export default function ApplicationReviewHeader({ application }) {
  const businessName =
    application.identity?.business_name || "Unnamed Business";
  const submissionCount = application.submission_count ?? 0;
  const isResubmission = submissionCount > 1;

  const status = application.status;
  const statusInfo = statusConfig[status];
  const statusAccent = statusAccents[status] ?? statusAccents.draft;

  const resolved = isApplicationResolved(status);

  const queueLabel = resolved ? "Resolved in" : "Time in queue";

  const queueEndTime = resolved
    ? application.reviewed_at || application.updated_at
    : Date.now();

  const queueValue = formatApplicationElapsedTime(
    application.submitted_at,
    queueEndTime,
  );

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Status accent strip */}
      <div className={`h-1 w-full ${statusAccent}`} />

      <div className="p-6">
        {/* Application identity and status */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-secondary">
              Application #{application.id}
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
              {businessName}
            </h1>

            <p className="mt-1 text-sm text-text-secondary">
              {application.identity?.business_cluster_name || "—"}
              {" · "}
              {application.identity?.business_category_name || "—"}
            </p>
          </div>

          <StatusBadge variant={statusInfo?.variant ?? "neutral"}>
            {statusInfo?.label ?? status ?? "—"}
          </StatusBadge>
        </div>

        {/* Resubmission context */}
        {isResubmission && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-info">
            <History size={16} className="shrink-0" />

            <span className="font-medium">
              Resubmission #{submissionCount - 1}
            </span>

            {application.previous_review?.decision === "rejected" && (
              <>
                <span className="text-info/60">·</span>
                <span>
                  Previously rejected on{" "}
                  {formatApplicationDate(
                    application.previous_review.reviewed_at,
                  )}
                </span>
              </>
            )}
          </div>
        )}
        {/* Key application facts */}
        <div className="mt-6 grid grid-cols-1 gap-5 border-t border-stroke pt-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <div className="min-w-0">
            <MetaItem
              icon={Calendar}
              label="Submitted"
              value={formatApplicationDate(application.submitted_at)}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <Contact
                size={18}
                strokeWidth={2}
                className="shrink-0 text-text-secondary"
              />

              <div className="min-w-0">
                <p className="text-xs font-medium text-text-secondary">
                  Submitted By
                </p>

                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <UserAvatar avatarUrl={application.submitter?.avatar_url} />

                  <p className="truncate text-sm font-medium text-text-primary">
                    {application.submitter?.name || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <MetaItem
              icon={Mail}
              label="Email"
              value={application.submitter?.email || "—"}
            />
          </div>

          <div className="min-w-0">
            <MetaItem
              icon={Clock}
              label={queueLabel}
              value={
                <ApplicationQueueStatus
                  submittedAt={application.submitted_at}
                  resolvedAt={application.reviewed_at}
                  days={application.time_in_queue_business_days}
                  status={application.queue_status}
                  compact
                />
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
