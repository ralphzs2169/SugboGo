import { useEffect, useState } from "react";

import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import TableTabs from "../components/data-table/TableTabs";
import TablePagination from "../components/data-table/TablePagination";
import NotificationList from "../notifications/components/NotificationList";
import NotificationUnreadCount from "../notifications/components/NotificationUnreadCount";
import useNotificationActions from "../notifications/hooks/useNotificationActions";
import {
  useNotificationSession,
  useNotificationUnreadCount,
  useNotifications,
} from "../notifications/hooks/useNotifications";

const FILTERS = [{ id: "all", label: "All" }, { id: "unread", label: "Unread" }];
const PAGE_SIZE = 10;

/** Present paginated recipient history using the existing Admin page and table controls. */
function NotificationHistory() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const count = useNotificationUnreadCount();
  const query = useNotifications({
    page,
    page_size: PAGE_SIZE,
    ...(filter === "unread" ? { is_read: false } : {}),
  });
  const actions = useNotificationActions({
    surface: "history",
    onRead: () => {
      if (filter === "unread") setPage(1);
    },
  });
  const pagination = query.data?.pagination;
  const unreadCount = count.data?.unread_count;

  // Header read actions can exhaust the current page without using history's onRead.
  useEffect(() => {
    if (
      filter === "unread" &&
      page > 1 &&
      unreadCount !== undefined &&
      unreadCount <= (page - 1) * PAGE_SIZE
    ) {
      setPage(1);
    }
  }, [filter, page, unreadCount]);

  useApiErrorNotification(query.error, {
    toastId: "admin-notification-history-load-error",
    fallbackMessage: "Unable to load notification history. Please try again.",
  });
  useApiErrorNotification(count.error, {
    toastId: "admin-notification-count-load-error",
    fallbackMessage: "Unable to load the unread notification count. Please try again.",
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Notifications"
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel" },
          { label: "Notifications" },
        ]}
        actions={(
          <Button
            variant="secondary"
            size="sm"
            loading={actions.isMarkingAll}
            disabled={count.data?.unread_count === 0 || actions.busy}
            onClick={actions.markAllRead}
          >
            Mark all as read
          </Button>
        )}
      />
      <div className="mb-4"><NotificationUnreadCount query={count} /></div>
      <section aria-label="Notification history" className="min-w-0 rounded-2xl border border-stroke bg-background p-3 sm:p-4">
        <div className="mb-4">
          <TableTabs
            tabs={FILTERS}
            activeTab={filter}
            tabListId="notification-filters"
            ariaLabel="Notification filters"
            onTabChange={(nextFilter) => {
              setFilter(nextFilter);
              setPage(1);
            }}
          />
        </div>
        <div
          role="tabpanel"
          id={`notification-filters-panel-${filter}`}
          aria-labelledby={`notification-filters-${filter}`}
        >
          <NotificationList query={query} actions={actions} unreadOnly={filter === "unread"} />
          {pagination && (
            <TablePagination
              pageIndex={pagination.page - 1}
              pageCount={pagination.total_pages}
              totalItems={pagination.total_items}
              pageSize={pagination.page_size}
              onPageChange={(pageIndex) => setPage(pageIndex + 1)}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/** Reset local history controls when its restored administrative account changes. */
export default function NotificationsPage() {
  useDocumentTitle("Notifications | SugboGo Admin");
  const session = useNotificationSession();
  if (!session.enabled) return null;
  return <NotificationHistory key={`${session.userId}:${session.role}`} />;
}
