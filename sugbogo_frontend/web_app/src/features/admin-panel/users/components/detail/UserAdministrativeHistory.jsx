import { History, UserCheck, UserX } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import { formatDateTime } from "@/shared/utils/dateUtils";

const ACTION_CONFIG = {
  user_suspended: {
    icon: UserX,
    label: "Account suspended",
    iconClassName: "text-red-600",
  },
  user_reactivated: {
    icon: UserCheck,
    label: "Account reactivated",
    iconClassName: "text-success",
  },
};

export default function UserAdministrativeHistory({
  history,
  pagination,
  isLoading,
  isFetching,
  error,
  onRetry,
  onPageChange,
}) {
  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Administrative History
      </h2>

      {error ? (
        <DataErrorState
          title="Unable to load administrative history"
          message="Administrative actions could not be loaded."
          onRetry={onRetry}
        />
      ) : (
        <div
          className="rounded-xl border border-stroke bg-background"
          aria-busy={isLoading || isFetching}
        >
          {isLoading ? (
            <div className="space-y-4 p-6" aria-label="Loading history">
              {[1, 2].map((item) => (
                <div key={item} className="flex animate-pulse gap-3">
                  <div className="h-9 w-9 rounded-full bg-surface" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-44 rounded bg-surface" />
                    <div className="h-3 w-56 rounded bg-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <History className="mx-auto h-9 w-9 text-text-secondary" />
              <p className="mt-3 text-sm font-semibold text-text-primary">
                No administrative actions recorded
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Suspension and reactivation actions will appear here.
              </p>
            </div>
          ) : (
            <>
              <ol className="divide-y divide-stroke">
                {history.map((entry) => {
                  const config = ACTION_CONFIG[entry.action] ?? {
                    icon: History,
                    label: entry.action,
                    iconClassName: "text-text-secondary",
                  };
                  const Icon = config.icon;

                  return (
                    <li key={entry.id} className="flex gap-4 p-5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface">
                        <Icon
                          className={`h-4 w-4 ${config.iconClassName}`}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary">
                          {config.label}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          By {entry.actor?.name || entry.actor?.email || "Unknown administrator"}
                        </p>
                        {entry.context?.reason && (
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface px-3 py-2 text-sm leading-6 text-text-secondary">
                            <span className="font-semibold text-text-primary">
                              Reason:
                            </span>{" "}
                            {entry.context.reason}
                          </p>
                        )}
                        <time className="mt-2 block text-xs text-text-secondary">
                          {formatDateTime(entry.timestamp)}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {pagination?.total_pages > 1 && (
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
    </section>
  );
}
