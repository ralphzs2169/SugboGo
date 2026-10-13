import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Flag, Image as ImageIcon, Inbox, MessageSquare, Pencil, Search, Store } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import Modal from "@/shared/components/modals/Modal";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatDateTime } from "@/shared/utils/dateUtils";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
import ReviewIdentityHeader from "../../moderation/components/ReviewIdentityHeader";
import ReviewStickyContextBar from "../../moderation/components/ReviewStickyContextBar";
import { formatReviewTimestamp } from "../../moderation/components/reviewPresentation";
import useReviewStickyContext from "../../moderation/hooks/useReviewStickyContext";
import { fetchBusiness } from "../../businesses/services/businessService";

import {
  decideReportedReview,
  fetchReportedReview,
  fetchReportedReviews,
} from "../services/reportedReviewService";
import {
  displayName,
  formatReportedQueueTime,
  pendingReasons,
  REPORT_REASONS,
} from "../utils/reportedReviewPresentation";
import { refreshReportedReview } from "../utils/refreshReportedReview";

const PAGE_SIZE = 10;

function NeedsAttentionBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Needs Attention
    </span>
  );
}

function ReasonBadges({ counts }) {
  const reasons = pendingReasons(counts).sort(
    ([first], [second]) => (counts[second] ?? 0) - (counts[first] ?? 0),
  );
  const visibleReasons = reasons.length > 3 ? reasons.slice(0, 2) : reasons;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleReasons.map(([reason]) => (
        <span key={reason} className="inline-flex items-center rounded-md border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
          {REPORT_REASONS[reason]}
        </span>
      ))}
      {reasons.length > 3 && (
        <span className="inline-flex items-center rounded-md border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
          +{reasons.length - visibleReasons.length} more
        </span>
      )}
    </div>
  );
}

function QueueItem({ review, selected, onSelect }) {
  const { data: businessDetails } = useQuery({
    queryKey: ["admin", "businesses", "detail", review.business.id],
    queryFn: () => fetchBusiness(review.business.id),
    enabled: Boolean(review.business.id) && !review.business.cover_photo_url,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const businessCoverUrl = review.business.cover_photo_url || businessDetails?.cover_photo_url;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full cursor-pointer border-b border-l-[3px] border-stroke px-4 py-3.5 text-left transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-info ${
        selected
          ? "border-l-info bg-info/5 hover:bg-info/10"
          : "border-l-transparent bg-background hover:bg-interaction-hover"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar
          avatarUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size="queue"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {displayName(review.author)}
            </span>
            <time dateTime={review.latest_pending_at} title={`Latest report: ${formatDateTime(review.latest_pending_at)}`} className="shrink-0 text-xs text-text-secondary">
              {formatReportedQueueTime(review.latest_pending_at)}
            </time>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stroke bg-surface-muted">
              {businessCoverUrl ? (
                <img src={businessCoverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 truncate" title={review.business.name}>{review.business.name}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">Review #{review.id}</span>
            {review.status === "rejected" && (
              <span className="shrink-0">· Rejected</span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-text-primary">
            {review.text_preview || "Photo review"}
          </p>
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${review.pending_report_count >= 3 ? "text-amber-700" : "text-text-secondary"}`}>
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              {review.pending_report_count} pending {review.pending_report_count === 1 ? "report" : "reports"}
            </span>
            <div className="mt-1.5">
              <ReasonBadges counts={review.reason_counts} />
            </div>
          </div>
          {(review.photo_count > 0 || review.has_reply || review.is_edited) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
              {review.photo_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {review.photo_count} {review.photo_count === 1 ? "photo" : "photos"}
                </span>
              )}
              {review.has_reply && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  Merchant replied
                </span>
              )}
              {review.is_edited && (
                <span className="inline-flex items-center gap-1">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edited
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ReportSummary({ review }) {
  return (
    <section aria-label="Community report summary" className="border-t border-stroke pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">Community Reports</h3>
        {review.needs_attention && (
          <NeedsAttentionBadge />
        )}
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        {review.pending_report_count} pending {review.pending_report_count === 1 ? "report" : "reports"}. Community reports are evidence for a decision about this review.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(REPORT_REASONS).map(([reason, label]) => (
          <div key={reason} className="rounded-lg border border-stroke bg-surface px-3 py-3">
            <dt className="text-xs text-text-secondary">{label}</dt>
            <dd className="mt-1 text-lg font-semibold text-text-primary">{review.reason_counts?.[reason] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
        <p>First pending report: {formatDateTime(review.first_pending_at)}</p>
        <p>Latest pending report: {formatDateTime(review.latest_pending_at)}</p>
      </div>
    </section>
  );
}

function ReportExplanation({ explanation, reportId }) {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (!text || !explanation) {
      return;
    }

    function measureOverflow() {
      const lineHeight = Number.parseFloat(window.getComputedStyle(text).lineHeight);
      setOverflows(text.scrollHeight > lineHeight * 3 + 1);
    }

    measureOverflow();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => window.removeEventListener("resize", measureOverflow);
    }

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(text.parentElement);
    return () => observer.disconnect();
  }, [explanation, expanded]);

  if (!explanation) {
    return null;
  }

  return (
    <div className="mt-2 min-w-0">
      <p
        ref={textRef}
        id={`report-explanation-${reportId}`}
        className={`whitespace-pre-wrap break-words text-sm leading-5 text-text-secondary ${expanded ? "" : "line-clamp-3"}`}
      >
        <span className="sr-only">Reporter's explanation: </span>
        {explanation}
      </p>
      {overflows && (
        <button
          type="button"
          aria-controls={`report-explanation-${reportId}`}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Show less" : "Show more"} of explanation for report #${reportId}`}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ReportRow({ report, resolved = false }) {
  return (
    <article className="px-4 py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex items-center rounded-md border border-stroke bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
            {REPORT_REASONS[report.type] ?? "Report"}
          </span>
          <time dateTime={report.created_at} className="text-xs text-text-secondary">
            {formatReviewTimestamp(report.created_at)}
          </time>
          {resolved && <StatusBadge variant="muted">{report.status}</StatusBadge>}
        </div>
        <span className="shrink-0 text-xs text-text-secondary">#{report.id}</span>
      </div>
      <ReportExplanation explanation={report.explanation} reportId={report.id} />
      {resolved && report.admin_notes && (
        <p className="mt-2 whitespace-pre-wrap break-words text-xs text-text-secondary">
          Decision notes: {report.admin_notes}
        </p>
      )}
    </article>
  );
}

function IndividualReports({ review }) {
  const pending = review.reports?.filter((report) => report.status === "pending") ?? [];
  const resolved = review.reports?.filter((report) => report.status !== "pending") ?? [];

  return (
    <section aria-label="Individual reports" className="border-t border-stroke pt-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-base font-semibold text-text-primary">Individual Reports</h3>
        <span className="text-xs text-text-secondary">
          {review.reports?.length ?? 0} {review.reports?.length === 1 ? "report" : "reports"}
        </span>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Community reports submitted about this review.
      </p>
      <div className="mt-4 divide-y divide-stroke overflow-hidden rounded-lg border border-stroke bg-background">
        {pending.map((report) => (
          <ReportRow key={report.id} report={report} />
        ))}
        {resolved.length > 0 && (
          <div className="bg-surface-muted px-4 py-2 text-xs font-semibold text-text-secondary">
            Previous Decisions
          </div>
        )}
        {resolved.map((report) => (
          <ReportRow key={report.id} report={report} resolved />
        ))}
      </div>
    </section>
  );
}

function AdminDecision({ review, onDecision, pending }) {
  const alreadyRejected = review.status === "rejected";

  return (
    <section aria-label="Admin decision" className="border-t border-stroke pt-6">
      <h3 className="text-base font-semibold text-text-primary">Admin Decision</h3>
      <p className="mt-1 text-sm text-text-secondary">
        {alreadyRejected
          ? `This review is already rejected. Its ${review.pending_report_count} remaining pending ${review.pending_report_count === 1 ? "report will" : "reports will"} be resolved without rejecting it again.`
          : `Decide whether this review should remain published. All ${review.pending_report_count} pending ${review.pending_report_count === 1 ? "report will" : "reports will"} be resolved together.`}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {!alreadyRejected && (
          <Button variant="secondary" className="min-h-11" disabled={pending} onClick={() => onDecision(review, "keep")}>
            Keep Review
          </Button>
        )}
        <Button variant="danger-outline" className="min-h-11" disabled={pending} onClick={() => onDecision(review, "reject")}>
          Reject Review
        </Button>
      </div>
    </section>
  );
}

function ReportedReviewDetail({ reviewId, onStale, onDecision, decisionPending }) {
  const { data: review, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "reported-reviews", "detail", reviewId],
    queryFn: () => fetchReportedReview(reviewId),
    enabled: Boolean(reviewId),
    retryOnMount: false,
  });
  const {
    scrollContainerRef,
    reviewHeaderRef,
    showContextBar,
  } = useReviewStickyContext(review?.id);

  if (!reviewId) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary">
        <Flag className="h-8 w-8" />
        <h2 className="mt-3 font-semibold text-text-primary">Select a reported review</h2>
        <p className="mt-1 text-sm">Choose a review to inspect its content and pending reports.</p>
      </div>
    );
  }
  if (isLoading) {
    return <div aria-busy="true" className="p-6 text-sm text-text-secondary">Loading reported review…</div>;
  }
  if (error) {
    return (
      <DataErrorState
        title="Unable to load this reported review"
        message="The review may no longer have pending reports."
        onRetry={() => error.response?.status === 404 ? onStale() : refetch()}
      />
    );
  }
  if (!review) {
    return null;
  }

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto lg:max-h-[calc(100vh-260px)]">
      <ReviewStickyContextBar review={review} visible={showContextBar} statusVariant={review.status === "rejected" ? "dangerSoft" : undefined} />
      <article className="space-y-6 p-5 sm:p-6">
        <div ref={reviewHeaderRef}>
          <ReviewIdentityHeader review={review} statusVariant={review.status === "rejected" ? "dangerSoft" : undefined} />
        </div>
        <ReviewContentCard review={review} />
        <ReportSummary review={review} />
        <IndividualReports review={review} />
        <AdminDecision review={review} onDecision={onDecision} pending={decisionPending} />
      </article>
    </div>
  );
}

export function DecisionDialog({ target, notes, onNotesChange, onClose, onConfirm, pending, error }) {
  if (!target) {
    return null;
  }

  const isReject = target.decision === "reject";
  const consequence = isReject
    ? target.reviewStatus === "rejected"
      ? "This review is already rejected. All remaining pending community reports will be marked as confirmed without rejecting the review again."
      : "The review will be rejected and all pending community reports for this review will be marked as confirmed. It will no longer remain published."
    : "The review will remain published and all pending community reports for this review will be dismissed.";

  return (
    <Modal
      isOpen
      title={isReject ? "Reject this review?" : "Keep this review?"}
      description={`Review #${target.reviewId}`}
      onClose={onClose}
      showCloseButton={!pending}
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-stroke bg-surface p-4 text-sm leading-6 text-text-secondary">
          {consequence}
        </p>
        <label className="block text-sm font-medium text-text-primary">
          Moderation notes <span className="text-text-secondary">(at least 20 characters)</span>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={4}
            maxLength={2000}
            disabled={pending}
            className="mt-2 w-full rounded-lg border border-stroke bg-background p-3 text-sm text-text-primary focus:border-stroke-active focus:outline-none"
            placeholder="Explain the review decision"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error.response?.data?.message || "The review decision could not be saved. Please try again."}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant={isReject ? "danger" : "secondary"}
            onClick={onConfirm}
            loading={pending}
            disabled={notes.trim().length < 20}
          >
            {isReject ? "Reject Review" : "Keep Review"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
