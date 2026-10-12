import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Inbox, Search, ShieldAlert } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import StatusBadge from "@/shared/components/StatusBadge";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatDateTime, formatRelativeDate } from "@/shared/utils/dateUtils";

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

function SignalBadges({ reasons = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => (
        <StatusBadge key={reason} variant="warning">
          {SIGNAL_LABELS[reason] ?? "Reliability signal"}
        </StatusBadge>
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
      className={`w-full border-b border-stroke px-4 py-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        selected ? "bg-surface-muted" : "bg-background"
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
              {displayName(review.author)}
            </span>
            <span className="shrink-0 text-xs text-text-secondary">
              {formatRelativeDate(review.submitted_at)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            Review #{review.id} · {review.business.name}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-text-primary">
            {review.text_preview}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SignalBadges reasons={review.reasons} />
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
    <article className="space-y-5 p-5 sm:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Investigation · Review #{review.id}</h2>
          <StatusBadge variant="success">Published</StatusBadge>
        </div>
        <SignalBadges reasons={review.reasons} />
      </header>
      <section className="border-t border-stroke pt-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Review</h3>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{review.text}</p>
        {review.photos?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {review.photos.map((photo, index) => (
              <a key={photo.id} href={photo.photo_url} target="_blank" rel="noreferrer" aria-label={`Open review photo ${index + 1}`} className="rounded-lg border border-stroke focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <img src={photo.photo_url} alt={`Review photo ${index + 1}`} className="h-24 w-24 rounded-lg object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>
      <DetectionEvidence review={review} />
      <CurrentActivity review={review} />
      <section className="border-t border-stroke pt-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">User / Business Context</h3>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p className="text-text-secondary">Author<br /><Link className="font-medium text-primary hover:underline" to={`/admin-panel/users/${review.author.id}`}>{displayName(review.author)}</Link></p>
          <p className="text-text-secondary">Business<br /><Link className="font-medium text-primary hover:underline" to={`/admin-panel/businesses/${review.business.id}`}>{review.business.name}</Link></p>
          <p className="text-text-secondary">Submitted<br /><span className="font-medium text-text-primary">{formatDateTime(review.submitted_at)}</span></p>
          <p className="text-text-secondary">Current status<br /><span className="font-medium text-text-primary">Published</span></p>
        </div>
      </section>
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
