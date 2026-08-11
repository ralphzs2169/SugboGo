import { Calendar, Contact, Clock, User, Mail } from "lucide-react";
import UserAvatar from "@/shared/components/UserAvatar";
import StatusBadge from "@/shared/components/StatusBadge";
import statusConfig from "../../config/applicationStatus.config";

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
        className=" shrink-0 text-text-secondary"
      />

      <div>
        <p className="text-xs font-medium text-text-secondary">{label}</p>

        <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
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

        {/* Key application facts */}
        <div className="mt-6 grid grid-cols-4 gap-4 border-t border-stroke pt-4">
          <MetaItem
            icon={Calendar}
            label="Submitted"
            value={formatApplicationDate(application.submitted_at)}
          />

          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
              <Contact size={15} />
              <span>Submitted By</span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <UserAvatar avatarUrl={application.submitter?.avatar_url} />

              <p className="text-sm font-medium text-text-primary">
                {application.submitter?.name || "—"}
              </p>
            </div>
          </div>

          <MetaItem
            icon={Mail}
            label="Email"
            value={application.submitter?.email || "—"}
          />

          <MetaItem icon={Clock} label={queueLabel} value={queueValue || "—"} />
        </div>
      </div>
    </section>
  );
}
