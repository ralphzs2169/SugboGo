import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Flag, Image as ImageIcon, Inbox, MessageSquare, Pencil, Search } from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import Modal from "@/shared/components/modals/Modal";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatDateTime } from "@/shared/utils/dateUtils";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
import ReviewIdentityHeader, { ReviewStatusBadge as ReviewStatus } from "../../moderation/components/ReviewIdentityHeader";
import { formatModerationQueueTime } from "../../moderation/components/reviewPresentation";

import {
  decideReviewReport,
  fetchReportedReview,
  fetchReportedReviews,
} from "../services/reportedReviewService";
import {
  displayName,
  pendingReasons,
  REPORT_REASONS,
} from "../utils/reportedReviewPresentation";
import { refreshReportedReview } from "../utils/refreshReportedReview";

const PAGE_SIZE = 10;

function ReasonBadges({ counts }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {pendingReasons(counts).map(([reason]) => (
        <span key={reason} className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-text-primary">
          <Flag className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
          {REPORT_REASONS[reason]}
        </span>
      ))}
    </div>
  );
}

function QueueItem({ review, selected, onSelect }) {
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
              {displayName(review.author)}
            </span>
            <time dateTime={review.submitted_at} title={formatDateTime(review.submitted_at)} className="shrink-0 text-xs text-text-secondary">
              {formatModerationQueueTime(review.submitted_at)}
            </time>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            Review #{review.id} · {review.business.name}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <p className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-text-primary">
              {review.text_preview || "Photo review"}
            </p>
            {review.first_photo_url && (
              <img src={review.first_photo_url} alt="Review photo thumbnail" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-stroke object-cover" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-semibold text-text-primary">
              {review.pending_report_count} pending {review.pending_report_count === 1 ? "report" : "reports"}
            </span>
            {review.needs_attention && (
              <StatusBadge variant="warning">Needs Attention</StatusBadge>
            )}
            <ReviewStatus status={review.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ReasonBadges counts={review.reason_counts} />
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
          <p className="mt-2 text-xs text-text-secondary">
            First: {formatDateTime(review.first_pending_at)} · Latest: {formatDateTime(review.latest_pending_at)}
          </p>
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
          <StatusBadge variant="warning">Needs Attention</StatusBadge>
        )}
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        {review.pending_report_count} pending {review.pending_report_count === 1 ? "report" : "reports"}. Reports are allegations awaiting individual decisions.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

function IndividualReports({ review, onDecision }) {
  const pending = review.reports?.filter((report) => report.status === "pending") ?? [];
  const resolved = review.reports?.filter((report) => report.status !== "pending") ?? [];

  return (
    <section aria-label="Individual reports" className="border-t border-stroke pt-5">
      <h3 className="text-base font-semibold text-text-primary">Individual Reports</h3>
      <p className="mt-1 text-sm text-text-secondary">
        Decide each pending community report separately. Other pending reports remain open after a decision.
      </p>
      <div className="mt-4 space-y-3">
        {pending.map((report) => (
          <article key={report.id} className="rounded-lg border border-stroke bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {REPORT_REASONS[report.type] ?? "Report"} · Report #{report.id}
                </h4>
                <p className="mt-1 text-xs text-text-secondary">Submitted {formatDateTime(report.created_at)}</p>
              </div>
              <StatusBadge variant="warning">Pending</StatusBadge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onDecision(report, "dismiss", review.status)}>Dismiss Report</Button>
              <Button size="sm" variant="danger-outline" onClick={() => onDecision(report, "confirm", review.status)}>Confirm Report</Button>
            </div>
          </article>
        ))}
      </div>
      {resolved.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-text-primary">Previous Decisions</h4>
          <div className="mt-3 space-y-2">
            {resolved.map((report) => (
              <article key={report.id} className="rounded-lg border border-stroke bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">
                    {REPORT_REASONS[report.type] ?? "Report"} · Report #{report.id}
                  </span>
                  <StatusBadge variant="muted">{report.status}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-text-secondary">Submitted {formatDateTime(report.created_at)}</p>
                {report.admin_notes && (
                  <p className="mt-2 whitespace-pre-wrap text-text-secondary">Decision notes: {report.admin_notes}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportedReviewDetail({ reviewId, onStale, onDecision }) {
  const { data: review, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "reported-reviews", "detail", reviewId],
    queryFn: () => fetchReportedReview(reviewId),
    enabled: Boolean(reviewId),
    retryOnMount: false,
  });

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
    <article className="space-y-6 p-5 sm:p-6">
      <ReviewIdentityHeader review={review} />
      <ReviewContentCard review={review} />
      <ReportSummary review={review} />
      <IndividualReports review={review} onDecision={onDecision} />
    </article>
  );
}

export function DecisionDialog({ target, notes, onNotesChange, onClose, onConfirm, pending, error }) {
  if (!target) {
    return null;
  }

  const isConfirm = target.decision === "confirm";
  const consequence = isConfirm
    ? target.reviewStatus === "published"
      ? "Confirming this report rejects the currently published review through the existing report decision process. Other pending reports remain open."
      : "This review is already rejected. Confirming this report records a decision on this report; other pending reports remain open."
    : "Dismissing this report leaves the review status unchanged and updates the pending report count.";

  return (
    <Modal
      isOpen
      title={`${isConfirm ? "Confirm" : "Dismiss"} Report #${target.report.id}`}
      description={`${REPORT_REASONS[target.report.type] ?? "Community"} report on review #${target.reviewId}`}
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
            placeholder="Explain the report decision"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error.response?.data?.message || "The report decision could not be saved. Please try again."}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant={isConfirm ? "danger" : "primary"}
            onClick={onConfirm}
            loading={pending}
            disabled={notes.trim().length < 20}
          >
            {isConfirm ? "Confirm Report" : "Dismiss Report"}
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
    mutationFn: ({ reportId, decision, adminNotes }) => (
      decideReviewReport(reportId, decision, adminNotes)
    ),
    onSuccess: async () => {
      setDecisionTarget(null);
      setNotes("");
      try {
        const result = await refreshReportedReview({
          queryClient,
          listKey,
          params,
          previousItems: reviews,
          selectedId,
          page,
        });
        if (result.nextId !== selectedId) {
          selectReview(result.nextId);
        }
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

  function openDecision(report, decision, reviewStatus) {
    mutation.reset();
    setNotes("");
    setDecisionTarget({ report, decision, reviewId: selectedId, reviewStatus });
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
      <main aria-label="Reported review investigation" className="min-w-0 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
        <ReportedReviewDetail reviewId={selectedId} onStale={handleStale} onDecision={openDecision} />
      </main>
      <DecisionDialog
        target={decisionTarget}
        notes={notes}
        onNotesChange={setNotes}
        onClose={closeDecision}
        onConfirm={() => mutation.mutate({ reportId: decisionTarget.report.id, decision: decisionTarget.decision, adminNotes: notes.trim() })}
        pending={mutation.isPending}
        error={mutation.error}
      />
    </div>
  );
}
