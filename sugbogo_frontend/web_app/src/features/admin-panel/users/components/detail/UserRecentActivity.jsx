import {
  FileCheck2,
  FileText,
  Flag,
  MessageSquareText,
  ShieldQuestion,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import { formatLabel } from "@/shared/utils/stringUtils";
import StatusBadge from "@/shared/components/StatusBadge";
import { REPORT_STATUSES, REVIEW_STATUSES } from "../../../all-reviews/utils/allReviewPresentation";

import { formatUserDateTime } from "../../utils/userPresentation";
import UserRecordLinks from "./UserRecordLinks";
import UserDetailHeading from "./UserDetailHeading";

const ACTIVITY_CONFIG = {
  review_created: {
    icon: MessageSquareText,
    label: "Submitted a review",
  },
  business_vouched: {
    icon: ThumbsUp,
    label: "Vouched for a business specialty",
  },
  review_reported: {
    icon: Flag,
    label: "Reported a review",
  },
  merchant_application_created: {
    icon: FileText,
    label: "Started a merchant application",
  },
  merchant_application_submitted: {
    icon: FileCheck2,
    label: "Submitted a merchant application",
  },
  review_dispute_created: {
    icon: ShieldQuestion,
    label: "Submitted a review dispute",
  },
};

function ActivityDescription({ activity }) {
  const data = activity.description_data ?? {};
  const statuses = activity.type === "review_reported" ? REPORT_STATUSES : REVIEW_STATUSES;

  return (
    <UserRecordLinks data={data}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-text-secondary [overflow-wrap:anywhere]">
        {data.status && (
          <div>
            <span className="sr-only">Status: </span>
            <StatusBadge variant={statuses[data.status]?.variant ?? "neutral"} showDot={false}>
              {formatLabel(data.status)}
            </StatusBadge>
          </div>
        )}
        {data.specialty_tag_name && <p>Specialty: {data.specialty_tag_name}</p>}
        {data.report_type && <p>Report type: {formatLabel(data.report_type)}</p>}
        {data.submission_number != null && (
          <p>
            Submission #{data.submission_number}
            {data.submission_number > 1 ? " · Resubmission" : ""}
          </p>
        )}
        {data.reason && <p>Reason: {formatLabel(data.reason)}</p>}
      </div>
    </UserRecordLinks>
  );
}

export default function UserRecentActivity({
  activities = [],
  isLoading,
  isFetching,
  hasData = false,
  error,
  onRetry,
  expanded = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section aria-label={expanded ? "Available recent activity" : "Recent activity"} className={expanded ? "min-w-0" : "min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5"}>
      {!expanded && <UserDetailHeading icon={MessageSquareText} title="Recent Activity" description="Latest 3 contributions · up to 20 available · PHT" />}

      {error && (
        <DataErrorState
          compact
          retainedData={hasData}
          refreshLabel="Recent activity"
          title="Unable to load user activity"
          message="Recent activity could not be loaded."
          onRetry={() => onRetry()}
          retrying={isFetching}
          retryLabel="Retry"
        />
      )}
      {(!error || hasData) && (
        <div
          className="min-w-0"
          aria-busy={isLoading || isFetching}
        >
          {isLoading ? (
            <div className="space-y-4 p-6" aria-label="Loading recent activity">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex gap-3 motion-safe:animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-surface" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-40 rounded bg-surface" />
                    <div className="h-3 w-24 rounded bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <MessageSquareText className="mx-auto h-9 w-9 text-text-secondary" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-text-primary">
                No recent contributions
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Recorded reviews, non-withdrawn vouches, submitted reports,
                applications, and disputes appear here.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-stroke">
              {(expanded ? activities : activities.slice(0, 3)).map((activity, index) => {
                const config = ACTIVITY_CONFIG[activity.type] ?? {
                  icon: MessageSquareText,
                  label: "User activity",
                };
                const Icon = config.icon;

                return (
                  <li
                    key={`${activity.type}-${activity.timestamp}-${index}`}
                    className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral/10 text-text-secondary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <p className="text-sm font-medium leading-5 text-text-primary">
                          {config.label}
                        </p>
                        <time dateTime={activity.timestamp} className="text-xs leading-5 text-text-secondary">
                          {formatUserDateTime(activity.timestamp)}
                        </time>
                      </div>
                      <div className="mt-1 text-sm text-text-secondary">
                        <ActivityDescription activity={activity} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
      {!expanded && activities.length > 3 && (
        <div className="mt-3 border-t border-stroke pt-3">
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>View All</Button>
        </div>
      )}
      {!expanded && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Recent Activity"
          description="Available recent contributions, newest first · up to 20 records from the existing API · PHT"
          maxWidth="max-w-3xl"
          scrollable
        >
          <UserRecentActivity
            expanded
            activities={activities}
            isLoading={isLoading}
            isFetching={isFetching}
            hasData={hasData}
            error={error}
            onRetry={onRetry}
          />
        </Modal>
      )}
    </section>
  );
}
