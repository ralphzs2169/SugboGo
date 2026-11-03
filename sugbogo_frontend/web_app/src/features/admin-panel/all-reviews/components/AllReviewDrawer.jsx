import { useCallback } from "react";
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
  const close = useCallback(() => onClose(), [onClose]);
  const gone = query.error?.response?.status === 404;

  return createPortal(
    <Modal
      isOpen
      title="Review Details"
      description={`Inspect review #${reviewId}`}
      onClose={close}
      placement="right"
      maxWidth="max-w-3xl"
      scrollable
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
