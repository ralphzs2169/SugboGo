import { Flag, Gavel, History, MessageSquareText, Store, UserCheck, UserPlus, UserX } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import Modal from "@/shared/components/modals/Modal";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { formatLabel } from "@/shared/utils/stringUtils";

import { formatUserDateTime } from "../../utils/userPresentation";
import UserRecordLinks from "./UserRecordLinks";
import UserDetailHeading from "./UserDetailHeading";
import useUserAdministrativeHistory from "../../hooks/useUserAdministrativeHistory";

const ACTION_LABELS = {
  admin_created: "Admin account created",
  business_suspended: "Business suspended",
  business_reactivated: "Business reactivated",
  review_dispute_upheld: "Review dispute upheld",
  review_dispute_dismissed: "Review dispute dismissed",
  review_report_approved: "Review report approved",
  review_report_rejected: "Review report rejected",
  reported_review_kept: "Reported review kept",
  reported_review_rejected: "Reported review rejected",
  review_moderation_approved: "Review approved after moderation",
  review_moderation_rejected: "Review rejected after moderation",
  review_deleted_by_author: "Review deleted by its author",
  business_name_change_approved: "Business name change approved",
  business_name_change_rejected: "Business name change rejected",
  business_classification_change_approved: "Business classification change approved",
  business_classification_change_rejected: "Business classification change rejected",
  business_location_change_approved: "Business location change approved",
  business_location_change_rejected: "Business location change rejected",
};

const ACTION_CONFIG = {
  user_suspended: {
    icon: UserX,
    label: "Account suspended",
    iconClassName: "text-danger",
  },
  user_reactivated: {
    icon: UserCheck,
    label: "Account reactivated",
    iconClassName: "text-success",
  },
};

/** Distinguishes the existing decision categories with dashboard-sized contextual icons. */
function historyIcon(action) {
  if (action.startsWith("business_")) return Store;
  if (action.includes("dispute")) return Gavel;
  if (action.includes("report")) return Flag;
  if (action.startsWith("review_")) return MessageSquareText;
  if (action === "admin_created") return UserPlus;
  return History;
}

/** Shows the recorded decision context without exposing internal moderation metadata. */
function HistoryContext({ entry }) {
  const context = entry.context ?? {};
  const transitions = [
    ["Review", context.previous_review_status, context.review_status],
    ["Report", context.previous_report_status, context.report_status],
    ["Dispute", context.previous_dispute_status, context.dispute_status],
    ["Business", context.previous_status, context.status],
  ];
  const notes = [
    ["Reason", context.reason],
    ["Administrator notes", context.admin_notes],
    ["Moderation notes", context.moderation_notes],
  ];

  return (
    <div className="mt-2 space-y-2">
      <UserRecordLinks data={context} />
      {context.report_type && (
        <p className="text-xs text-text-secondary">
          Report type: {formatLabel(context.report_type)}
        </p>
      )}
      {transitions.map(([label, previous, current]) => current && (
        <p key={label} className="text-xs text-text-secondary">
          {label}: {previous ? `${formatLabel(previous)} → ` : ""}{formatLabel(current)}
        </p>
      ))}
      {notes.map(([label, value]) => value && (
        <div key={label} className="rounded-lg bg-surface px-3 py-2 text-sm leading-6">
          <p className="font-semibold text-text-primary">{label}</p>
          <p className="whitespace-pre-wrap text-text-secondary [overflow-wrap:anywhere]">
            {label === "Reason" && entry.action.startsWith("review_dispute_")
              ? formatLabel(value)
              : value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function UserAdministrativeHistory({
  userId,
  history = [],
  pagination,
  isLoading,
  isFetching,
  hasData = false,
  error,
  onRetry,
  onPageChange,
  expanded = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasMore = history.length > 3 || pagination?.total_items > 3 || pagination?.total_pages > 1;

  return (
    <section aria-label={expanded ? "Available administrative history" : "Administrative history"} className={expanded ? "min-w-0" : "min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5"}>
      {!expanded && <UserDetailHeading icon={History} title="Administrative History" description="Latest 3 recorded decisions · newest first · PHT" />}

      {error && (
        <DataErrorState
          compact
          retainedData={hasData}
          refreshLabel="Administrative history"
          title="Unable to load administrative history"
          message="Administrative actions could not be loaded."
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
            <div className="space-y-4 p-6" aria-label="Loading history">
              {[1, 2].map((item) => (
                <div key={item} className="flex gap-3 motion-safe:animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-surface" />
                  <div className="min-w-0 flex-1 space-y-2 py-1">
                    <div className="h-3 w-44 max-w-full rounded bg-surface" />
                    <div className="h-3 w-56 max-w-full rounded bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <History className="mx-auto h-9 w-9 text-text-secondary" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-text-primary">
                No administrative actions recorded
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Recorded account, business, and moderation actions involving
                this user appear here.
              </p>
            </div>
          ) : (
            <>
              <ol className="divide-y divide-stroke">
                {(expanded ? history : history.slice(0, 3)).map((entry) => {
                  const config = ACTION_CONFIG[entry.action] ?? {
                    icon: historyIcon(entry.action),
                    label: ACTION_LABELS[entry.action] ?? formatLabel(entry.action),
                    iconClassName: "text-text-secondary",
                  };
                  const Icon = config.icon;

                  return (
                    <li key={entry.id} className="flex items-start gap-3 py-4 first:pt-1 last:pb-1">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral/10">
                        <Icon
                          className={`h-4 w-4 ${config.iconClassName}`}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <p className="text-sm font-medium leading-5 text-text-primary">
                            {config.label}
                          </p>
                          <time dateTime={entry.timestamp} className="text-xs leading-5 text-text-secondary">
                            {formatUserDateTime(entry.timestamp)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
                          By {entry.actor?.id ? (
                            <Link
                              to={`/admin-panel/users/${entry.actor.id}`}
                              className="font-medium text-text-secondary underline decoration-stroke underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-info"
                            >
                              {entry.actor.name || entry.actor.email || `User #${entry.actor.id}`}
                            </Link>
                          ) : "Actor unavailable"}
                          {entry.actor?.role && ` · ${formatLabel(entry.actor.role)}`}
                        </p>
                        <HistoryContext entry={entry} />
                      </div>
                    </li>
                  );
                })}
              </ol>

              {expanded && pagination?.total_pages > 1 && (
                <div className="flex items-center justify-between border-t border-stroke px-5 py-4">
                  <span className="text-xs text-text-secondary">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.has_previous || isFetching}
                      onClick={() => onPageChange(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!pagination.has_next || isFetching}
                      onClick={() => onPageChange(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {!expanded && hasMore && (
        <div className="mt-3 border-t border-stroke pt-3">
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>View All</Button>
        </div>
      )}
      {!expanded && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Administrative History"
          description="Recorded decisions available through the existing paginated history API · newest first · PHT"
          maxWidth="max-w-3xl"
          scrollable
        >
          <HistoryDialog
            userId={userId}
            history={history}
            pagination={pagination}
            isLoading={isLoading}
            isFetching={isFetching}
            hasData={hasData}
            error={error}
            onRetry={onRetry}
            onPageChange={onPageChange}
          />
        </Modal>
      )}
    </section>
  );
}

/** Pages the dialog independently so the main preview always remains newest-first. */
function HistoryDialog({ userId, ...preview }) {
  const [page, setPage] = useState(1);
  const query = useUserAdministrativeHistory(
    userId,
    { page, page_size: 10 },
    { enabled: Boolean(userId) },
  );
  useApiErrorNotification(query.error, {
    toastId: `admin-user-${userId}-history-dialog-error`,
    fallbackMessage: "Unable to load administrative history. Please try again.",
  });

  return (
    <UserAdministrativeHistory
      {...(userId ? {
        history: query.history,
        pagination: query.pagination,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        hasData: query.hasData,
        error: query.error,
        onRetry: query.refetch,
        onPageChange: setPage,
      } : preview)}
      expanded
    />
  );
}
