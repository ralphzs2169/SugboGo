import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Inbox, Search } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";

import {
  decideReportedReview,
  fetchReportedReviews,
} from "../services/reportedReviewService";
import { REPORT_REASONS } from "../utils/reportedReviewPresentation";
import { refreshReportedReview } from "../utils/refreshReportedReview";
import DecisionDialog from "./DecisionDialog";
import QueueItem from "./QueueItem";
import ReportedReviewDetail from "./ReportedReviewDetail";

export { default as DecisionDialog } from "./DecisionDialog";

const PAGE_SIZE = 10;

export default function ReportedReviewWorkspace() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("reported_id")) || null;
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
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
    ordering,
  }), [page, debouncedSearch, reason, ordering]);
  const listKey = ["admin", "reported-reviews", "list", params];
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchReportedReviews(params),
    placeholderData: keepPreviousData,
    retryOnMount: false,
  });
  const reviews = data?.items ?? [];
  const pagination = data?.pagination;
  const mutation = useMutation({
    mutationFn: ({ reviewId, decision, adminNotes }) => (
      decideReportedReview(reviewId, decision, adminNotes)
    ),
    onSuccess: async () => {
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
        <div className="border-b border-stroke p-5">
          <h2 className="text-base font-semibold text-text-primary">Reported Reviews</h2>
          <p className="mt-1 text-sm text-text-secondary">One review per queue item, with all pending reports together.</p>
          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-secondary" />
            <span className="sr-only">Search reported reviews</span>
            <input
              type="search"
              value={search}
              onChange={(event) => changeFilter(setSearch, event.target.value)}
              placeholder="Search reviews, authors, businesses"
              className="w-full rounded-lg border border-stroke bg-background py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-stroke-active focus:outline-none"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-text-secondary">
              Report reason
              <select
                aria-label="Report reason"
                value={reason}
                onChange={(event) => changeFilter(setReason, event.target.value)}
                className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary"
              >
                <option value="">All reasons</option>
                {Object.entries(REPORT_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-text-secondary">
              Sort
              <select
                aria-label="Sort reported reviews"
                value={ordering}
                onChange={(event) => changeFilter(setOrdering, event.target.value)}
                className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary"
              >
                <option value="most_reported">Most Reported</option>
                <option value="oldest">Oldest Report</option>
                <option value="newest">Newest Report</option>
              </select>
            </label>
          </div>
        </div>
        <div aria-busy={isLoading || isFetching} className="lg:max-h-[calc(100vh-360px)] lg:overflow-y-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-text-secondary">Loading reported reviews…</p>
          ) : error ? (
            <DataErrorState title="Unable to load reported reviews" message="The community report queue could not be loaded." onRetry={refetch} />
          ) : reviews.length ? (
            reviews.map((review) => (
              <QueueItem key={review.id} review={review} selected={review.id === selectedId} onSelect={() => selectReview(review.id)} />
            ))
          ) : (
            <div className="p-8 text-center text-text-secondary">
              <Inbox className="mx-auto h-8 w-8" />
              <p className="mt-3 text-sm font-medium text-text-primary">No reported reviews currently need attention.</p>
              <p className="mt-1 text-sm">Try a different search or report reason.</p>
            </div>
          )}
        </div>
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-4 py-3 text-sm text-text-secondary">
            <button type="button" disabled={!pagination.has_previous} onClick={() => { setPage((value) => value - 1); selectReview(null); }} className="disabled:opacity-40">Previous</button>
            <span>Page {pagination.page} of {pagination.total_pages}</span>
            <button type="button" disabled={!pagination.has_next} onClick={() => { setPage((value) => value + 1); selectReview(null); }} className="disabled:opacity-40">Next</button>
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
