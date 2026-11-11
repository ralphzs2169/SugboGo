import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Inbox, Flag } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";
import ModerationQueueSkeleton from "../../moderation/components/ModerationQueueSkeleton";
import { isUnavailableQueuePage } from "../../moderation/utils/queuePagination";

import {
  decideReportedReview,
  fetchReportedReviews,
} from "../services/reportedReviewService";
import { refreshReportedReview } from "../utils/refreshReportedReview";
import { invalidateDashboardDecision } from "../../dashboard/queries/dashboardQueryEffects";
import { notifyBusinessChanged } from "../../businesses/queries/businessResourceEvents";
import DecisionDialog from "./DecisionDialog";
import QueueFilters from "./QueueFilters";
import QueueItem from "./QueueItem";
import ReportedReviewDetail from "./ReportedReviewDetail";

export { default as DecisionDialog } from "./DecisionDialog";

const PAGE_SIZE = 10;

export default function ReportedReviewWorkspace() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("reported_id")) || null;
  const aging = searchParams.get("queue_scope") === "aging";
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [ordering, setOrdering] = useState("most_reported");
  const [page, setPage] = useState(1);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [notes, setNotes] = useState("");
  const debouncedSearch = useDebounce(search);
  const params = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch,
    reason: reason || undefined,
    status: status || undefined,
    ordering,
    ...(aging ? { aging: true } : {}),
  }), [page, debouncedSearch, reason, status, ordering, aging]);
  const listKey = ["admin", "reported-reviews", "list", params];
  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    refetch,
  } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchReportedReviews(params),
    placeholderData: keepPreviousData,
    retryOnMount: false,
  });
  const reviews = data?.items ?? [];
  const pagination = data?.pagination;
  useApiErrorNotification(error, {
    toastId: "admin-reported-reviews-list-load-error",
    fallbackMessage: "Unable to load reported reviews. Please try again.",
  });

  const unavailablePage = isUnavailableQueuePage(error, page);
  const paginationReady = (
    !isFetching &&
    !isPlaceholderData &&
    !error &&
    pagination?.page === page &&
    Number.isInteger(pagination?.total_pages) &&
    page >= 1 &&
    page <= pagination.total_pages
  );
  const mutation = useMutation({
    mutationFn: ({ reviewId, decision, adminNotes }) => (
      decideReportedReview(reviewId, decision, adminNotes)
    ),
    onSuccess: async () => {
      notifyBusinessChanged(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation-counts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "moderation-summary"] });
      await invalidateDashboardDecision(queryClient);
      setDecisionTarget(null);
      setNotes("");
      selectReview(null);
      try {
        const result = await refreshReportedReview({
          queryClient,
          listKey,
          params,
          previousItems: reviews,
          selectedId,
          page,
        });
        selectReview(result.nextId);
        if (result.previousPage) {
          setPage(page - 1);
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: ["admin", "reported-reviews", "list"] });
        queryClient.invalidateQueries({
          queryKey: ["admin", "reported-reviews", "detail", selectedId],
        });
      }
    },
  });

  function selectReview(reviewId) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (reviewId) {
        next.set("reported_id", String(reviewId));
      } else {
        next.delete("reported_id");
      }
      return next;
    });
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
    selectReview(null);
  }

  function changePage(nextPage) {
    if (
      !paginationReady ||
      !Number.isInteger(nextPage) ||
      nextPage < 1 ||
      nextPage > pagination.total_pages ||
      Math.abs(nextPage - page) !== 1 ||
      (nextPage < page && !pagination.has_previous) ||
      (nextPage > page && !pagination.has_next)
    ) {
      return;
    }

    // A second click from the same render cannot queue another transition.
    setPage((current) => current === pagination.page ? nextPage : current);
    selectReview(null);
  }

  function returnToFirstPage() {
    setPage(1);
    selectReview(null);
  }

  function openDecision(review, decision) {
    mutation.reset();
    setNotes("");
    setDecisionTarget({ decision, reviewId: review.id, reviewStatus: review.status });
  }

  function closeDecision() {
    if (!mutation.isPending) {
      setDecisionTarget(null);
      setNotes("");
      mutation.reset();
    }
  }

  function handleStale() {
    selectReview(null);
    refetch();
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]">
      <aside aria-label="Reported review queue" className="min-w-0 border-b border-stroke lg:border-b-0 lg:border-r">
        <div className="px-4 pt-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Flag aria-hidden="true" className="h-4 w-4 shrink-0" />
            Reported Reviews
          </h2>
          <p className="mt-1 text-sm text-text-secondary">One review per queue item, with all pending reports together.</p>
        </div>
        <QueueFilters
          search={search}
          reason={reason}
          status={status}
          ordering={ordering}
          onSearchChange={(value) => changeFilter(setSearch, value)}
          onReasonChange={(value) => changeFilter(setReason, value)}
          onStatusChange={(value) => changeFilter(setStatus, value)}
          onOrderingChange={(value) => changeFilter(setOrdering, value)}
        />
        <div aria-busy={isLoading || isFetching} className="themed-scrollbar lg:max-h-[calc(100vh-360px)] lg:overflow-y-auto">
          {isLoading || isPlaceholderData ? (
            <ModerationQueueSkeleton label="Loading reported reviews" />
          ) : error ? (
            <DataErrorState
              title="Unable to load reported reviews"
              message={
                unavailablePage
                  ? "This page is no longer available. Return to the first page to reload the queue."
                  : "The community report queue could not be loaded."
              }
              onRetry={unavailablePage ? returnToFirstPage : refetch}
              retryLabel={unavailablePage ? "Return to first page" : "Try Again"}
              retrying={isFetching}
            />
          ) : reviews.length ? (
            reviews.map((review) => (
              <QueueItem key={review.id} review={review} selected={review.id === selectedId} onSelect={() => selectReview(review.id)} />
            ))
          ) : (
            <div className="p-8 text-center text-text-secondary">
              <Inbox className="mx-auto h-8 w-8" />
              <p className="mt-3 text-sm font-medium text-text-primary">No reported reviews currently need attention.</p>
              <p className="mt-1 text-sm">Try a different search or filter.</p>
            </div>
          )}
        </div>
        {pagination && !error && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-4 py-3 text-sm text-text-secondary">
            <button
              type="button"
              disabled={
                !paginationReady ||
                !pagination.has_previous ||
                page <= 1
              }
              onClick={() => changePage(page - 1)}
              className="disabled:opacity-40"
            >
              Previous
            </button>
            <span role="status">
              {isPlaceholderData || pagination.page !== page
                ? `Loading page ${page}…`
                : `Page ${pagination.page} of ${pagination.total_pages}`}
            </span>
            <button
              type="button"
              disabled={
                !paginationReady ||
                !pagination.has_next ||
                page >= pagination.total_pages
              }
              onClick={() => changePage(page + 1)}
              className="disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </aside>
      <main aria-label="Reported review investigation" className="min-w-0">
        <ReportedReviewDetail key={selectedId} reviewId={selectedId} onStale={handleStale} onDecision={openDecision} decisionPending={mutation.isPending} />
      </main>
      <DecisionDialog
        target={decisionTarget}
        notes={notes}
        onNotesChange={setNotes}
        onClose={closeDecision}
        onConfirm={() => mutation.mutate({ reviewId: decisionTarget.reviewId, decision: decisionTarget.decision, adminNotes: notes.trim() })}
        pending={mutation.isPending}
        error={mutation.error}
      />
    </div>
  );
}
