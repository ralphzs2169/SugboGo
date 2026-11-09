import { Bell } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import TableEmptyState from "../../components/data-table/TableEmptyState";
import NotificationRow from "./NotificationRow";

/** Share notification loading, persistent recovery, and row presentation across surfaces. */
export default function NotificationList({ query, actions, unreadOnly = false }) {
  const items = query.data?.items ?? [];
  return (
    <>
      {actions.error && (
        <DataErrorState
          compact
          title="Unable to mark notifications as read"
          message="Your read action was not saved. Please try again."
          onRetry={actions.retry}
          retryLabel="Retry"
          retrying={actions.busy}
        />
      )}
      {query.error && (
        <DataErrorState
          compact
          title="Unable to load notifications"
          message="Notifications could not be loaded. Please try again."
          retainedData={items.length > 0}
          refreshLabel="Notifications"
          onRetry={() => query.refetch()}
          retryLabel="Retry"
          retrying={query.isFetching}
        />
      )}
      {query.isPending && (
        <div role="status" aria-label="Loading notifications" className="space-y-4 px-4 py-6">
          {[0, 1, 2].map((id) => (
            <div key={id} aria-hidden="true" className="flex gap-3 motion-safe:animate-pulse">
              <span className="h-9 w-9 shrink-0 rounded-full bg-skeleton" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-2/3 rounded bg-skeleton" />
                <span className="block h-3 w-full rounded bg-skeleton" />
              </span>
            </div>
          ))}
        </div>
      )}
      {!query.isPending && !query.error && items.length === 0 && (
        <TableEmptyState
          compact
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          description={unreadOnly ? "You're all caught up." : "Updates requiring your attention will appear here."}
          icon={<Bell aria-hidden="true" className="h-8 w-8 text-text-secondary" />}
        />
      )}
      {items.length > 0 && (
        <ul aria-label="Notifications" aria-busy={query.isFetching || actions.busy}>
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onSelect={actions.selectNotification}
              disabled={actions.busy}
            />
          ))}
        </ul>
      )}
    </>
  );
}
