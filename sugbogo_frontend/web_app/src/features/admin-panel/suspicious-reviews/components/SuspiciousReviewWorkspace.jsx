import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Clock3, Image as ImageIcon, Inbox, MessageSquare, Pencil, Search, ShieldAlert, UsersRound } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import UserAvatar from "@/shared/components/UserAvatar";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatDateTime } from "@/shared/utils/dateUtils";
import ReviewContentCard from "../../moderation/components/ReviewContentCard";
import ReviewIdentityHeader from "../../moderation/components/ReviewIdentityHeader";
import { formatModerationQueueTime } from "../../moderation/components/reviewPresentation";

import {
  fetchSuspiciousReview,
  fetchSuspiciousReviews,
} from "../services/suspiciousReviewService";
import {
  BASIS_LABELS,
  SIGNAL_LABELS,
  displayName,
} from "../utils/suspiciousReviewPresentation";

const PAGE_SIZE = 10;

const SIGNAL_ICONS = {
  duplicate_content: ShieldAlert,
  rapid_submission: Clock3,
  shared_installation_accounts: UsersRound,
};

function SignalBadges({ reasons = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => {
        const Icon = SIGNAL_ICONS[reason] ?? ShieldAlert;
        return (
          <span key={reason} className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-text-primary">
            <Icon className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            {SIGNAL_LABELS[reason] ?? "Reliability signal"}
          </span>
        );
      })}
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
            <SignalBadges reasons={review.reasons} />
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

function DetectionEvidence({ review }) {
  const evidence = review.detection_evidence ?? {};

  return (
    <section className="border-t border-stroke pt-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
        Why It Was Flagged
      </h3>
      <p className="mt-1 text-sm text-text-secondary">
        Detection-time evidence recorded when the review was submitted.
      </p>
      <div className="mt-4 space-y-4">
        {review.reasons.map((reason) => {
          const item = evidence[reason];
          return (
            <div key={reason} className="rounded-lg border border-stroke bg-surface p-4">
              <h4 className="text-sm font-semibold text-text-primary">
                {SIGNAL_LABELS[reason]}
              </h4>
              {!item ? (
                <p className="mt-2 text-sm text-text-secondary">
                  Detection-time details were not recorded for this historical review.
                </p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-text-secondary">
                  {reason === "duplicate_content" && (
                    <>
                      <p>Same normalized review text detected.</p>
                      <p>{item.prior_match_count} prior matching reviews · {BASIS_LABELS[item.basis] ?? "Same user or installation"}</p>
                      {item.matched_reviews?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.matched_reviews.map((match) => (
                            match.available ? (
                              <a key={match.id} href={`#related-review-${match.id}`} className="rounded-md border border-stroke px-2 py-1 text-xs text-primary hover:underline">
                                View review #{match.id}
                              </a>
                            ) : (
                              <span key={match.id} className="rounded-md border border-stroke px-2 py-1 text-xs">
                                Review #{match.id} · unavailable/deleted
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {reason === "rapid_submission" && (
                    <p>{item.review_count} reviews with the same app installation identifier within {item.window_hours} hours.</p>
                  )}
                  {reason === "shared_installation_accounts" && (
                    <p>{item.distinct_account_count} distinct accounts using the same app installation identifier reviewed this business.</p>
                  )}
                  {item.observed_at && (
                    <p className="text-xs">Observed {formatDateTime(item.observed_at)}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CurrentActivity({ review }) {
  const activity = review.current_related_activity ?? {};

  return (
    <section className="border-t border-stroke pt-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
        Current Related Activity
      </h3>
      <p className="mt-1 text-sm text-text-secondary">
        Live data currently available. This may differ if reviews were edited or deleted later.
      </p>
      <div className="mt-4 space-y-5">
        {activity.referenced_reviews?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-text-primary">Retained reviews referenced at detection</h4>
            <p className="mt-1 text-xs text-text-secondary">Current record details; text or status may have changed since detection.</p>
            <div className="mt-2 space-y-2">
              {activity.referenced_reviews.map((item) => (
                <details key={item.id} id={`related-review-${item.id}`} className="rounded-lg border border-stroke p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-text-primary">Review #{item.id} · {item.status}</summary>
                  <p className="mt-2 whitespace-pre-wrap text-text-primary">{item.text}</p>
                  <p className="mt-2 text-text-secondary">
                    <Link className="text-primary hover:underline" to={`/admin-panel/users/${item.author.id}`}>{displayName(item.author)}</Link>
                    {" · "}
                    <Link className="text-primary hover:underline" to={`/admin-panel/businesses/${item.business.id}`}>{item.business.name}</Link>
                    {" · "}{formatDateTime(item.submitted_at)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}
        {review.reasons.map((reason) => {
          const related = activity[reason];
          return (
            <div key={reason}>
              <h4 className="text-sm font-semibold text-text-primary">
                {SIGNAL_LABELS[reason]}
              </h4>
              {reason === "shared_installation_accounts" && related && (
                <p className="mt-1 text-xs text-text-secondary">
                  {related.distinct_account_count} distinct accounts currently retained
                </p>
              )}
              {!related?.reviews?.length ? (
                <p className="mt-2 text-sm text-text-secondary">No related records currently available.</p>
              ) : (
                <ul className="mt-2 divide-y divide-stroke rounded-lg border border-stroke">
                  {related.reviews.map((item) => (
                    <li key={item.id} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-text-primary">Review #{item.id} · {item.status}</span>
                        <span className="text-xs text-text-secondary">{formatDateTime(item.submitted_at)}</span>
                      </div>
                      <p className="mt-1 text-text-secondary">
                        <Link className="text-primary hover:underline" to={`/admin-panel/users/${item.author.id}`}>{displayName(item.author)}</Link>
                        {" · "}
                        <Link className="text-primary hover:underline" to={`/admin-panel/businesses/${item.business.id}`}>{item.business.name}</Link>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InvestigationDetail({ reviewId, onStale }) {
  const { data: review, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "suspicious-reviews", "detail", reviewId],
    queryFn: () => fetchSuspiciousReview(reviewId),
    enabled: Boolean(reviewId),
    retryOnMount: false,
  });

  if (!reviewId) {
    return <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary"><ShieldAlert className="h-8 w-8" /><h2 className="mt-3 font-semibold text-text-primary">Select a review</h2><p className="mt-1 text-sm">Choose a review from the queue to investigate its reliability signals.</p></div>;
  }
  if (isLoading) {
    return <div aria-busy="true" className="p-6 text-sm text-text-secondary">Loading investigation…</div>;
  }
  if (error) {
    return <DataErrorState title="Unable to load this investigation" message="The review may no longer be in the suspicious queue." onRetry={() => error.response?.status === 404 ? onStale() : refetch()} />;
  }
  if (!review) {
    return null;
  }

  return (
    <article className="space-y-6 p-5 sm:p-6">
      <ReviewIdentityHeader review={review} />
      <ReviewContentCard review={review} />
      <section aria-label="Reliability signals" className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Reliability Signals</h3>
        <SignalBadges reasons={review.reasons} />
      </section>
      <DetectionEvidence review={review} />
      <CurrentActivity review={review} />
    </article>
  );
}

export default function SuspiciousReviewWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("suspicious_id")) || null;
  const [search, setSearch] = useState("");
  const [signal, setSignal] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const params = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch,
    signal: signal || undefined,
    ordering,
  }), [page, debouncedSearch, signal, ordering]);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "suspicious-reviews", "list", params],
    queryFn: () => fetchSuspiciousReviews(params),
    placeholderData: keepPreviousData,
    retryOnMount: false,
  });
  const reviews = data?.items ?? [];
  const pagination = data?.pagination;

  function selectReview(reviewId) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (reviewId) {
        next.set("suspicious_id", String(reviewId));
      } else {
        next.delete("suspicious_id");
      }
      return next;
    });
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
    selectReview(null);
  }

  function handleStale() {
    selectReview(null);
    refetch();
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]">
      <aside aria-label="Suspicious review queue" className="min-w-0 border-b border-stroke lg:border-b-0 lg:border-r">
        <div className="border-b border-stroke p-5">
          <h2 className="text-base font-semibold text-text-primary">Suspicious Reviews</h2>
          <p className="mt-1 text-sm text-text-secondary">Published reviews with advisory reliability signals.</p>
          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-secondary" />
            <span className="sr-only">Search suspicious reviews</span>
            <input type="search" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} placeholder="Search reviews, authors, businesses" className="w-full rounded-lg border border-stroke bg-background py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-stroke-active focus:outline-none" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-text-secondary">Signal
              <select aria-label="Signal" value={signal} onChange={(event) => changeFilter(setSignal, event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary">
                <option value="">All signals</option>
                {Object.entries(SIGNAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-text-secondary">Sort
              <select aria-label="Sort" value={ordering} onChange={(event) => changeFilter(setOrdering, event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-background px-2 py-2 text-sm text-text-primary">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </div>
        <div aria-busy={isLoading || isFetching} className="lg:max-h-[calc(100vh-360px)] lg:overflow-y-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-text-secondary">Loading suspicious reviews…</p>
          ) : error ? (
            <DataErrorState title="Unable to load suspicious reviews" message="The investigation queue could not be loaded." onRetry={refetch} />
          ) : reviews.length ? (
            reviews.map((review) => <QueueItem key={review.id} review={review} selected={review.id === selectedId} onSelect={() => selectReview(review.id)} />)
          ) : (
            <div className="p-8 text-center text-text-secondary"><Inbox className="mx-auto h-8 w-8" /><p className="mt-3 text-sm font-medium text-text-primary">No suspicious reviews found</p><p className="mt-1 text-sm">Try a different search or signal.</p></div>
          )}
        </div>
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-4 py-3 text-sm text-text-secondary">
            <button type="button" disabled={!pagination.has_previous} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">Previous</button>
            <span>Page {pagination.page} of {pagination.total_pages}</span>
            <button type="button" disabled={!pagination.has_next} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">Next</button>
          </div>
        )}
      </aside>
      <main aria-label="Suspicious review investigation" className="min-w-0 lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
        <InvestigationDetail reviewId={selectedId} onStale={handleStale} />
      </main>
    </div>
  );
}
