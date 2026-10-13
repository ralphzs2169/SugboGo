import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Inbox, Search } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";

import { fetchSuspiciousReviews } from "../services/suspiciousReviewService";
import { SIGNAL_LABELS } from "../utils/suspiciousReviewPresentation";
import InvestigationDetail from "./InvestigationDetail";
import QueueItem from "./QueueItem";

const PAGE_SIZE = 10;

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
      <main aria-label="Suspicious review investigation" className="min-w-0">
        <InvestigationDetail key={selectedId} reviewId={selectedId} onStale={handleStale} />
      </main>
    </div>
  );
}
