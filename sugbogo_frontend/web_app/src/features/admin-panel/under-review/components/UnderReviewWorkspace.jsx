import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox, Search } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatRelativeDate } from "@/shared/utils/dateUtils";

import useUnderReviewReviews from "../hooks/useUnderReviewReviews";
import useUnderReviewDecisions from "../hooks/useUnderReviewDecisions";
import {
  HOLD_REASON_LABELS,
  nextReviewId,
} from "../utils/underReviewPresentation";
import UnderReviewDetail from "./UnderReviewDetail";

const PAGE_SIZE = 10;

function QueueFilters({ filters, onChange }) {
  return (
    <div className="space-y-3 border-b border-stroke p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
        <span className="sr-only">Search held reviews</span>
        <input
          type="search"
          placeholder="Search reviews, authors, businesses"
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          className="w-full rounded-lg border border-stroke bg-background py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-stroke-active focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        <label className="text-xs font-medium text-text-secondary">
          Reason
          <select
            aria-label="Reason"
            value={filters.reason}
            onChange={(event) => onChange("reason", event.target.value)}
            className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary"
          >
            <option value="">All reasons</option>
            <option value="text_flagged">Text flagged</option>
            <option value="image_flagged">Image flagged</option>
            <option value="local_cebuano_safety">Potential violent threat</option>
            <option value="provider_failure">Provider failure</option>
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Content
          <select
            aria-label="Content"
            value={filters.content}
            onChange={(event) => onChange("content", event.target.value)}
            className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary"
          >
            <option value="">All content</option>
            <option value="has_photos">Has photos</option>
            <option value="text_only">Text only</option>
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Sort
          <select
            aria-label="Sort"
            value={filters.ordering}
            onChange={(event) => onChange("ordering", event.target.value)}
            className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function QueueItem({ review, selected, onSelect }) {
  const authorName = [review.author.first_name, review.author.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full cursor-pointer border-b border-stroke p-4 text-left transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        selected ? "bg-surface ring-inset ring-2 ring-primary" : "bg-background"
      }`}
    >
      <div className="flex gap-3">
        {review.first_photo_url && (
          <img
            src={review.first_photo_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {authorName}
            </span>
            <span className="shrink-0 text-xs text-text-secondary">
              {formatRelativeDate(review.submitted_at)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {review.business.name}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-text-primary">
            {review.text_preview || "Photo review"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {review.hold_reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                {HOLD_REASON_LABELS[reason] ?? reason}
              </span>
            ))}
            {review.photo_count > 0 && (
              <span className="text-xs text-text-secondary">
                {review.photo_count} {review.photo_count === 1 ? "photo" : "photos"}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

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
  const [confirmReject, setConfirmReject] = useState(false);
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
    if (!selectedId) {
      return;
    }

    try {
      if (action === "approve") {
        await approve(selectedId);
        toast.success("Review approved and published.");
      } else {
        await reject(selectedId);
        toast.success("Review rejected.");
      }
      setConfirmReject(false);
      selectReview(nextReviewId(reviews, selectedId));
      if (reviews.length === 1 && page > 1) {
        setPage(page - 1);
      }
    } catch (decisionError) {
      const message = decisionError.response?.data?.message;
      toast.error(message || "Unable to resolve this review. The queue will refresh.");
      setConfirmReject(false);
      selectReview(null);
      await refetch();
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
            <div aria-busy="true" className="space-y-3 p-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
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
            reviewId={selectedId}
            onApprove={() => resolveReview("approve")}
            onReject={() => setConfirmReject(true)}
            onStale={() => {
              selectReview(null);
              refetch();
            }}
            isApproving={isApproving}
            isRejecting={isRejecting}
          />
        </main>
      </div>

      <Modal
        isOpen={confirmReject}
        title="Reject review?"
        description="This review will not be published. This decision cannot be undone here."
        onClose={() => setConfirmReject(false)}
      >
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmReject(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={isRejecting}
            onClick={() => resolveReview("reject")}
          >
            Reject Review
          </Button>
        </div>
      </Modal>
    </>
  );
}
