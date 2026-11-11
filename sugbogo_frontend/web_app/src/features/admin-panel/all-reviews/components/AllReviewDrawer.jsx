import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import Modal from "@/shared/components/modals/Modal";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import ModerationDetailSkeleton from "../../moderation/components/ModerationDetailSkeleton";
import { allReviewDetailOptions } from "../queries/allReviewQueries";
import AllReviewDetail from "./AllReviewDetail";

/** Fetch selected details on demand inside the existing focus-managed modal primitive. */
export default function AllReviewDrawer({ reviewId, onClose }) {
  const query = useQuery(allReviewDetailOptions(reviewId));
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const close = useCallback(() => {
    setIsVisible(false);
    setIsClosing(true);
  }, []);
  useApiErrorNotification(query.error, {
    toastId: "admin-all-reviews-detail-load-error",
    fallbackMessage: "Unable to load review details. Please try again.",
  });

  const gone = query.error?.response?.status === 404;

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
      title="Review Details"
      description={`Inspect review #${reviewId}`}
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
          <ModerationDetailSkeleton
            label="Loading review details"
            sections={["Reports", "Stored analysis", "Decision history"]}
          />
        ) : query.error ? (
          <DataErrorState
            title={
              gone
                ? "Review no longer available"
                : "Unable to load review details"
            }
            message={
              gone
                ? "This review may have been removed. Close the drawer to return to the directory."
                : "The review details could not be loaded. Your table filters are preserved."
            }
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.data ? (
          <>
            {query.isFetching && (
              <p role="status" className="mb-3 text-xs text-text-secondary">
                Refreshing review details…
              </p>
            )}
            <AllReviewDetail key={reviewId} review={query.data} />
          </>
        ) : null}
      </div>
    </Modal>,
    document.body,
  );
}
