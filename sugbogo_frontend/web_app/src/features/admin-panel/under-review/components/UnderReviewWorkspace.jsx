import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  CloudOff,
  Flag,
  Image as ImageIcon,
  Inbox,
  MessageSquare,
  Pencil,
  Search,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import UserAvatar from "@/shared/components/UserAvatar";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatDateTime } from "@/shared/utils/dateUtils";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";

import useUnderReviewReviews from "../hooks/useUnderReviewReviews";
import useUnderReviewDecisions from "../hooks/useUnderReviewDecisions";
import {
  formatModerationQueueTime,
  nextReviewId,
} from "../utils/underReviewPresentation";
import UnderReviewDetail from "./UnderReviewDetail";

const PAGE_SIZE = 10;

const REASON_OPTIONS = [
  { value: "text_flagged", label: "Text flagged" },
  { value: "image_flagged", label: "Image flagged" },
  { value: "local_cebuano_safety", label: "Potential violent threat" },
  { value: "provider_failure", label: "Check unavailable" },
];

const CONTENT_OPTIONS = [
  { value: "has_photos", label: "Has photos" },
  { value: "text_only", label: "Text only" },
];

const QUEUE_REASON_PRESENTATION = {
  text_flagged: {
    label: "Text flagged",
    icon: Flag,
    iconClassName: "text-danger",
    badgeClassName: "border-danger/25 bg-danger/10",
  },
  image_flagged: {
    label: "Image flagged",
    icon: ImageIcon,
    iconClassName: "text-danger",
    badgeClassName: "border-danger/25 bg-danger/10",
  },
  local_cebuano_safety: {
    label: "Potential violent threat",
    icon: ShieldAlert,
    iconClassName: "text-danger",
    badgeClassName: "border-danger/25 bg-danger/10",
  },
  provider_failure: {
    label: "Check unavailable",
    icon: CloudOff,
    iconClassName: "text-warning",
    badgeClassName: "border-warning/30 bg-warning/10",
  },
};

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterMenu
          filters={[
            {
              key: "reason",
              label: "Reason",
              icon: Flag,
              options: REASON_OPTIONS,
              value: filters.reason,
              onChange: (value) => onChange("reason", value),
            },
            {
              key: "content",
              label: "Content",
              icon: ImageIcon,
              options: CONTENT_OPTIONS,
              value: filters.content,
              onChange: (value) => onChange("content", value),
            },
          ]}
        />
        <label className="relative inline-flex items-center">
          <span className="sr-only">Sort under review queue</span>
          <select
            aria-label="Sort under review queue"
            value={filters.ordering}
            onChange={(event) => onChange("ordering", event.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-md border border-stroke-strong bg-background py-2 pl-3 pr-8 text-xs font-medium text-text-primary outline-none hover:bg-interaction-hover focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />
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
      className={`w-full cursor-pointer border-b border-l-2 border-stroke px-4 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        selected
          ? "border-l-primary bg-primary/5 hover:bg-primary/10"
          : "border-l-transparent bg-background hover:bg-interaction-hover"
      }`}
    >
      <div className="flex items-start gap-2">
        <UserAvatar
          avatarUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {authorName}
            </span>
            <time
              dateTime={review.submitted_at}
              title={formatDateTime(review.submitted_at)}
              className="shrink-0 text-xs text-text-secondary"
            >
              {formatModerationQueueTime(review.submitted_at)}
            </time>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {review.business.name}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <p className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-text-primary">
              {review.text_preview || "Photo review"}
            </p>
            {review.first_photo_url && (
              <img
                src={review.first_photo_url}
                alt="Review photo thumbnail"
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded-lg border border-stroke object-cover"
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {review.hold_reasons.map((reason) => {
              const presentation = QUEUE_REASON_PRESENTATION[reason];
              if (!presentation) {
                return null;
              }
              const Icon = presentation.icon;
              return (
                <span
                  key={reason}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-text-primary ${presentation.badgeClassName}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${presentation.iconClassName}`} aria-hidden="true" />
                  {presentation.label}
                </span>
              );
            })}
            {review.photo_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {review.photo_count} {review.photo_count === 1 ? "photo" : "photos"}
              </span>
            )}
            {review.has_reply && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Reply
              </span>
            )}
            {review.is_edited && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edited
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
            key={selectedId}
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
