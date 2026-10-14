import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";
import ModerationQueueSkeleton from "../../moderation/components/ModerationQueueSkeleton";

import { fetchSuspiciousReviews } from "../services/suspiciousReviewService";
import { firstReviewOnLoadedPage } from "../utils/queueSelection";
import InvestigationDetail from "./InvestigationDetail";
import QueueFilters from "./QueueFilters";
import QueueItem from "./QueueItem";

const PAGE_SIZE = 10;

export default function SuspiciousReviewWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("suspicious_id")) || null;
  const [search, setSearch] = useState("");
  const [signal, setSignal] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [page, setPage] = useState(1);
  const pageToSelect = useRef(null);
  const debouncedSearch = useDebounce(search);
  const params = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch,
    signal: signal || undefined,
    ordering,
  }), [page, debouncedSearch, signal, ordering]);
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ["admin", "suspicious-reviews", "list", params],
    queryFn: () => fetchSuspiciousReviews(params),
    placeholderData: keepPreviousData,
    retryOnMount: false,
  });
  const reviews = data?.items ?? [];
  const pagination = data?.pagination;

  useEffect(() => {
    const nextReviewId = firstReviewOnLoadedPage({
      targetPage: pageToSelect.current,
      loadedPage: pagination?.page,
      isLoading,
      isPlaceholderData,
      error,
      reviews: data?.items ?? [],
    });
    if (nextReviewId === undefined) {
      return;
    }

    if (nextReviewId !== null) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set("suspicious_id", String(nextReviewId));
        return next;
      });
    }
    pageToSelect.current = null;
  }, [page, isLoading, isPlaceholderData, error, pagination?.page, data?.items, setSearchParams]);

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
    pageToSelect.current = null;
    selectReview(null);
  }

  function changePage(nextPage) {
    pageToSelect.current = nextPage;
    setPage(nextPage);
    selectReview(null);
  }

  function handleStale() {
    selectReview(null);
    refetch();
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]">
      <aside aria-label="Suspicious review queue" className="min-w-0 border-b border-stroke lg:border-b-0 lg:border-r">
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold text-text-primary">Suspicious Reviews</h2>
          <p className="mt-1 text-sm text-text-secondary">Published reviews with advisory reliability signals.</p>
        </div>
        <QueueFilters
          search={search}
          signal={signal}
          ordering={ordering}
          onSearchChange={(value) => changeFilter(setSearch, value)}
          onSignalChange={(value) => changeFilter(setSignal, value)}
          onOrderingChange={(value) => changeFilter(setOrdering, value)}
        />
        <div aria-busy={isLoading || isFetching} className="lg:max-h-[calc(100vh-360px)] lg:overflow-y-auto">
          {isLoading || isPlaceholderData ? (
            <ModerationQueueSkeleton label="Loading suspicious reviews" />
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
            <button type="button" disabled={isFetching || !pagination.has_previous} onClick={() => changePage(page - 1)} className="disabled:opacity-40">Previous</button>
            <span>Page {pagination.page} of {pagination.total_pages}</span>
            <button type="button" disabled={isFetching || !pagination.has_next} onClick={() => changePage(page + 1)} className="disabled:opacity-40">Next</button>
          </div>
        )}
      </aside>
      <main aria-label="Suspicious review investigation" className="min-w-0">
        <InvestigationDetail key={selectedId} reviewId={selectedId} onStale={handleStale} />
      </main>
    </div>
  );
}
