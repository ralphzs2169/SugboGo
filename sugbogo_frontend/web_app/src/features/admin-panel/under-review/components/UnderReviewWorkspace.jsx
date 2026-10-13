import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";
import ModerationQueueSkeleton from "../../moderation/components/ModerationQueueSkeleton";

import useUnderReviewReviews from "../hooks/useUnderReviewReviews";
import useUnderReviewDecisions from "../hooks/useUnderReviewDecisions";
import { nextReviewId } from "../utils/underReviewPresentation";
import DecisionDialog from "./DecisionDialog";
import QueueFilters from "./QueueFilters";
import QueueItem from "./QueueItem";
import UnderReviewDetail from "./UnderReviewDetail";

const PAGE_SIZE = 10;

export default function UnderReviewWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("under_review_id")) || null;
  const [filters, setFilters] = useState({
    search: "",
    reason: "",
    content: "",
    ordering: "oldest",
  });
  const [page, setPage] = useState(1);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [moderationNotes, setModerationNotes] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const debouncedSearch = useDebounce(filters.search);
  const params = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch,
    reason: filters.reason || undefined,
    content: filters.content || undefined,
    ordering: filters.ordering,
  }), [page, debouncedSearch, filters.reason, filters.content, filters.ordering]);
  const {
    reviews,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useUnderReviewReviews(params);
  const {
    approve,
    reject,
    isApproving,
    isRejecting,
  } = useUnderReviewDecisions();

  function selectReview(reviewId) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (reviewId) {
        next.set("under_review_id", String(reviewId));
      } else {
        next.delete("under_review_id");
      }
      return next;
    });
  }

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    selectReview(null);
  }

  async function resolveReview(action) {
    if (!selectedId || (action === "reject" && moderationNotes.trim().length < 20)) {
      return;
    }

    setDecisionError("");
    try {
      if (action === "approve") {
        await approve(selectedId);
        toast.success("Review approved and published.");
      } else {
        await reject({
          reviewId: selectedId,
          moderationNotes: moderationNotes.trim(),
        });
        toast.success("Review rejected.");
      }
      setDecisionTarget(null);
      setModerationNotes("");
      selectReview(nextReviewId(reviews, selectedId));
      if (reviews.length === 1 && page > 1) {
        setPage(page - 1);
      }
    } catch (error) {
      const response = error.response?.data;
      const fieldError = response?.errors?.moderation_notes;
      const message = Array.isArray(fieldError)
        ? fieldError.join(" ")
        : fieldError || response?.message || "Unable to resolve this review. Please try again.";
      if (action === "reject") {
        setDecisionError(message);
      } else {
        toast.error(message);
        setDecisionTarget(null);
        selectReview(null);
        await refetch();
      }
    }
  }

  return (
    <>
      <div className="grid min-h-[640px] overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.5fr)]">
        <aside className="min-w-0 border-b border-stroke lg:border-b-0 lg:border-r" aria-label="Under Review queue">
          <div className="flex items-center justify-between px-4 pt-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Under Review Queue</h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                {pagination?.total_items ?? 0} waiting for a decision
              </p>
            </div>
            {isFetching && !isLoading && (
              <span className="text-xs text-text-secondary">Refreshing…</span>
            )}
          </div>
          <QueueFilters filters={filters} onChange={updateFilter} />

          {isLoading ? (
            <ModerationQueueSkeleton label="Loading under-review reviews" />
          ) : error ? (
            <DataErrorState
              title="Unable to load reviews"
              message="The moderation queue could not be loaded."
              onRetry={refetch}
            />
          ) : reviews.length ? (
            <>
              <div className="overflow-y-auto lg:max-h-[calc(100vh-380px)]">
                {reviews.map((review) => (
                  <QueueItem
                    key={review.id}
                    review={review}
                    selected={selectedId === review.id}
                    onSelect={() => selectReview(review.id)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-stroke p-3 text-xs text-text-secondary">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!pagination?.has_previous}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <span>Page {page} of {pagination?.total_pages ?? 1}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!pagination?.has_next}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <Inbox className="h-9 w-9 text-text-secondary" />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">
                {filters.search || filters.reason || filters.content
                  ? "No reviews match these filters"
                  : "No reviews currently need moderation"}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                New held reviews will appear here when they need a decision.
              </p>
            </div>
          )}
        </aside>

        <main className="min-w-0" aria-label="Under Review details">
          <UnderReviewDetail
            key={selectedId}
            reviewId={selectedId}
            onApprove={() => setDecisionTarget("approve")}
            onReject={() => {
              setModerationNotes("");
              setDecisionError("");
              setDecisionTarget("reject");
            }}
            onStale={() => {
              selectReview(null);
              refetch();
            }}
            isApproving={isApproving}
            isRejecting={isRejecting}
          />
        </main>
      </div>

      <DecisionDialog
        decision={decisionTarget}
        reviewId={selectedId}
        pending={isApproving || isRejecting}
        notes={moderationNotes}
        onNotesChange={(value) => {
          setModerationNotes(value);
          setDecisionError("");
        }}
        error={decisionError}
        onClose={() => {
          if (!isApproving && !isRejecting) {
            setDecisionTarget(null);
            setModerationNotes("");
            setDecisionError("");
          }
        }}
        onConfirm={() => resolveReview(decisionTarget)}
      />
    </>
  );
}
