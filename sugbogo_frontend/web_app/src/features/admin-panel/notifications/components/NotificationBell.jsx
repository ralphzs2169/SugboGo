import { useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import Button from "@/shared/components/Button";
import useNotificationLoadError from "../hooks/useNotificationLoadError";
import useNotificationActions from "../hooks/useNotificationActions";
import {
  useNotificationSession,
  useNotificationUnreadCount,
  useNotifications,
} from "../hooks/useNotifications";
import NotificationList from "./NotificationList";
import NotificationUnreadCount from "./NotificationUnreadCount";

const RECENT_PARAMS = { page: 1, page_size: 10 };

/** Fetch recent items only while open and reconcile them when the badge changes. */
function RecentNotifications({ count, actions }) {
  const location = useLocation();
  const query = useNotifications(RECENT_PARAMS);
  const unreadCount = count.data?.unread_count;
  const previousCount = useRef(unreadCount);
  const { refetch } = query;
  useEffect(() => {
    if (unreadCount !== undefined && previousCount.current !== unreadCount) {
      void refetch();
    }
    previousCount.current = unreadCount;
  }, [unreadCount, refetch]);
  useNotificationLoadError(
    { recent: query, count },
    location.pathname !== "/admin-panel/notifications",
  );
  return (
    <>
      <div className="px-4 pt-3">
        <NotificationUnreadCount query={count} suppressed={Boolean(query.error && count.error && !count.data)} />
      </div>
      <NotificationList query={query} count={count} actions={actions} />
    </>
  );
}

/** Provide a bell-anchored disclosure with native keyboard controls and bounded content. */
function NotificationBellContent({ count }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const focusOnOpen = useRef(false);
  const panelId = useId();
  const unreadCount = count.data?.unread_count;

  function dismiss(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }

  const actions = useNotificationActions({
    surface: "dropdown",
    onNavigate: () => dismiss(),
  });

  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) {
      panelRef.current?.querySelector("button:not(:disabled), a")?.focus();
      focusOnOpen.current = false;
    }
    function outsidePointer(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outsidePointer);
    return () => document.removeEventListener("pointerdown", outsidePointer);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          dismiss(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        aria-describedby={`${panelId}-count`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            focusOnOpen.current = true;
            if (open) {
              panelRef.current?.querySelector("button:not(:disabled), a")?.focus();
            } else {
              setOpen(true);
            }
          }
        }}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-interaction-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-info"
      >
        <Bell aria-hidden="true" className="h-5 w-5 stroke-[1.75]" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <span id={`${panelId}-count`} className="sr-only">
          {unreadCount === undefined ? "Unread count unavailable" : `${unreadCount} unread`}
        </span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-3 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stroke bg-background shadow-lg"
        >
          <div className="border-b border-stroke px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-text-primary">Notifications</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={unreadCount === 0 || actions.busy}
                loading={actions.isMarkingAll}
                onClick={actions.markAllRead}
              >
                Mark all as read
              </Button>
            </div>
          </div>
          <div className="themed-scrollbar max-h-96 overflow-y-auto overscroll-contain">
            <RecentNotifications count={count} actions={actions} />
          </div>
          <Link
            to="/admin-panel/notifications"
            onClick={() => dismiss()}
            className="block border-t border-stroke px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

/** Keep polling mounted in the header while resetting disclosures on navigation or account changes. */
export default function NotificationBell() {
  const session = useNotificationSession();
  const count = useNotificationUnreadCount({ poll: true });
  const location = useLocation();
  if (!session.enabled) return null;
  return (
    <NotificationBellContent
      key={`${session.userId}:${session.role}:${location.key}`}
      count={count}
    />
  );
}
