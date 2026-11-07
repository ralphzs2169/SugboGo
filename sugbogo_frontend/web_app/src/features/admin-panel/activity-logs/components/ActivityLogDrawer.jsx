import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/shared/components/modals/Modal";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useActivityLog } from "../hooks/useActivityLogs";
import ActivityLogDetail from "./ActivityLogDetail";

/** Fetch one occurrence in the same focus-managed, animated drawer used by management pages. */
export default function ActivityLogDrawer({ eventId, onClose }) {
  const query = useActivityLog(eventId);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const gone = query.error?.response?.status === 404;
  const close = useCallback(() => {
    setIsVisible(false);
    setIsClosing(true);
  }, []);

  useApiErrorNotification(query.error, {
    toastId: "admin-activity-detail-load-error",
    fallbackMessage: "Unable to load activity details. Please try again.",
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isClosing) return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(onClose, reducedMotion ? 0 : 300);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);

  return createPortal(
    <Modal
      isOpen
      title="Activity Details"
      description="Inspect the recorded event and available historical information."
      onClose={close}
      placement="right"
      maxWidth="max-w-3xl"
      scrollable
      bodyClassName="themed-scrollbar"
      overlayClassName={`transition-opacity duration-300 motion-reduce:transition-none ${isVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      panelClassName={`transition-transform duration-300 ease-out motion-reduce:transition-none ${isVisible ? "translate-x-0" : "translate-x-full"}`}
    >
      <div aria-busy={query.isFetching}>
        {query.isLoading ? (
          <div role="status" aria-label="Loading activity details" className="space-y-5">
            <span className="sr-only">Loading activity details</span>
            {[1, 2, 3].map((item) => (
              <div key={item} aria-hidden="true" className="space-y-3 rounded-lg border border-stroke p-4">
                <div className="h-5 w-36 animate-pulse rounded bg-skeleton" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-skeleton" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-skeleton" />
              </div>
            ))}
          </div>
        ) : query.error ? (
          <DataErrorState
            title={gone ? "Activity no longer available" : "Unable to load activity details"}
            message={gone
              ? "This activity may have expired or its source record may have been removed. Close the drawer to return to the activity list."
              : "The activity details could not be loaded. Your table filters and page are preserved."}
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.data ? (
          <>
            {query.isFetching && (
              <p role="status" className="mb-3 text-xs text-text-secondary">Refreshing activity details…</p>
            )}
            <ActivityLogDetail activity={query.data} />
          </>
        ) : null}
      </div>
    </Modal>,
    document.body,
  );
}
