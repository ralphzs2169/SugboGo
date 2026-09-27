import {
  FileCheck2,
  FileText,
  Flag,
  MessageSquareText,
  ShieldQuestion,
  ThumbsUp,
} from "lucide-react";
import { Link } from "react-router-dom";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import { formatDateTime } from "@/shared/utils/dateUtils";

const ACTIVITY_CONFIG = {
  review_created: {
    icon: MessageSquareText,
    label: "Posted a review",
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

  if (data.business_id && data.business_name) {
    return (
      <Link
        to={`/admin-panel/businesses/${data.business_id}`}
        className="font-medium text-primary hover:underline"
      >
        {data.business_name}
      </Link>
    );
  }

  if (data.application_id) {
    return (
      <Link
        to={`/admin-panel/business/application/${data.application_id}`}
        className="font-medium text-primary hover:underline"
      >
        Application #{data.application_id}
      </Link>
    );
  }

  return null;
}

export default function UserRecentActivity({
  activities,
  isLoading,
  error,
  onRetry,
}) {
  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Recent Activity
      </h2>

      {error ? (
        <DataErrorState
          title="Unable to load user activity"
          message="Recent activity could not be loaded."
          onRetry={onRetry}
        />
      ) : (
        <div className="rounded-xl border border-stroke bg-background">
          {isLoading ? (
            <div className="space-y-4 p-6" aria-label="Loading recent activity">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse gap-3">
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
              <MessageSquareText className="mx-auto h-9 w-9 text-text-secondary" />
              <p className="mt-3 text-sm font-semibold text-text-primary">
                No supported activity yet
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Reviews, vouches, reports, applications, and disputes will
                appear here.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-stroke">
              {activities.map((activity, index) => {
                const config = ACTIVITY_CONFIG[activity.type] ?? {
                  icon: MessageSquareText,
                  label: "User activity",
                };
                const Icon = config.icon;

                return (
                  <li
                    key={`${activity.type}-${activity.timestamp}-${index}`}
                    className="flex gap-4 p-5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">
                        {config.label}
                      </p>
                      <div className="mt-1 text-sm text-text-secondary">
                        <ActivityDescription activity={activity} />
                      </div>
                      <time className="mt-2 block text-xs text-text-secondary">
                        {formatDateTime(activity.timestamp)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
