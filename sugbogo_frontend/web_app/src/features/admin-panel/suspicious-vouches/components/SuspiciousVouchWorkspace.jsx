import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Inbox, ShieldAlert } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import UserAvatar from "@/shared/components/UserAvatar";
import useDebounce from "@/shared/hooks/useDebounce";
import { formatDateTime } from "@/shared/utils/dateUtils";
import SortMenu from "../../components/data-table/SortMenu";
import ModerationQueueSkeleton from "../../moderation/components/ModerationQueueSkeleton";
import {
  fetchSuspiciousVouch,
  fetchSuspiciousVouches,
} from "../services/suspiciousVouchService";

const REASON = "shared_installation_account_concentration";
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

function reasonLabel(reasons = []) {
  return reasons.includes(REASON)
    ? "Shared installation account concentration"
    : "Reason not recorded";
}

function authorName(author) {
  return [author?.first_name, author?.last_name].filter(Boolean).join(" ") || "Unknown user";
}

function SupportState({ vouch }) {
  return (
    <p className="text-xs text-text-secondary">
      {vouch.withdrawn_at ? "Withdrawn" : "Not withdrawn"}
      {" · "}
      {vouch.evidence_is_valid ? "Valid evidence" : "Invalid evidence"}
    </p>
  );
}

function VouchDetail({ vouchId, onStale }) {
  const { data: vouch, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "suspicious-vouches", "detail", vouchId],
    queryFn: () => fetchSuspiciousVouch(vouchId),
    enabled: Boolean(vouchId),
    retryOnMount: false,
  });

  if (!vouchId) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center text-text-secondary">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        <h2 className="mt-3 font-semibold text-text-primary">Select a vouch</h2>
        <p className="mt-1 text-sm">Choose a vouch to inspect its advisory finding.</p>
      </div>
    );
  }
  if (isLoading) {
    return <ModerationQueueSkeleton label="Loading vouch investigation" />;
  }
  if (error) {
    return (
      <DataErrorState
        title="Unable to load this vouch"
        message="The flagged submission may no longer be available."
        onRetry={() => error.response?.status === 404 ? onStale() : refetch()}
      />
    );
  }
  if (!vouch) {
    return null;
  }

  const finding = vouch.detection_evidence?.[REASON];
  const activity = vouch.current_related_activity;
  return (
    <article className="space-y-6 overflow-y-auto p-5 sm:p-6 lg:max-h-[calc(100vh-300px)]">
      <header className="space-y-2">
        <h2 className="text-base font-semibold text-text-primary">Vouch #{vouch.id}</h2>
        <Link className="text-sm text-info hover:underline" to={`/admin-panel/users/${vouch.author.id}`}>
          {authorName(vouch.author)}
        </Link>
        <p>
          <Link className="text-sm text-info hover:underline" to={`/admin-panel/businesses/${vouch.business.id}`}>
            {vouch.business.name}
          </Link>
        </p>
        <p className="text-sm text-text-primary">Specialty: {vouch.specialty.name}</p>
        <p className="text-xs text-text-secondary">Submitted {formatDateTime(vouch.submitted_at)}</p>
        <SupportState vouch={vouch} />
        {vouch.withdrawn_at && (
          <p className="text-xs text-text-secondary">Withdrawn {formatDateTime(vouch.withdrawn_at)}</p>
        )}
      </header>
      <section className="space-y-3 border-t border-stroke pt-5" aria-label="Vouch detection evidence">
        <h3 className="font-semibold text-text-primary">Why This Vouch Was Flagged</h3>
        <p className="text-sm text-text-primary">{reasonLabel(vouch.reasons)}</p>
        {finding ? (
          <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-text-primary">
            <p>{finding.distinct_account_count} distinct accounts submitted vouches for this business using the same app installation within {finding.window_hours} hours.</p>
            <p>Trigger threshold: {finding.threshold} distinct accounts.</p>
            <p className="text-xs text-text-secondary">Detected {formatDateTime(finding.observed_at)}</p>
            <p className="text-xs text-text-secondary">Window starts {formatDateTime(finding.window_start)}</p>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Detection details were not recorded for this historical flag.</p>
        )}
        <p className="text-xs leading-relaxed text-text-secondary">
          Advisory signal only. Shared devices and legitimate group activity can produce this pattern.
          This flag does not change evidence validity, scoring, or reputation.
        </p>
      </section>
      <section className="space-y-3 border-t border-stroke pt-5" aria-label="Related vouch submissions">
        <h3 className="font-semibold text-text-primary">Current Related Activity</h3>
        <p className="text-xs text-text-secondary">Retained submissions in the original observation window. Current state may differ from the detection snapshot.</p>
        {activity?.window_unavailable ? (
          <p className="text-sm text-text-secondary">The original detection window is unavailable.</p>
        ) : activity?.items?.length ? (
          <ul className="divide-y divide-stroke rounded-lg border border-stroke">
            {activity.items.map((item) => (
              <li key={item.id} className="space-y-1 p-3">
                <p className="text-sm text-text-primary">{authorName(item.author)} · Vouch #{item.id}</p>
                <p className="text-xs text-text-secondary">{item.specialty.name} · {formatDateTime(item.submitted_at)}</p>
                <SupportState vouch={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">No related submissions are currently available.</p>
        )}
        {activity?.has_more && <p className="text-xs text-text-secondary">Showing the 20 most recent related submissions.</p>}
      </section>
    </article>
  );
}

export default function SuspiciousVouchWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("suspicious_vouch_id")) || null;
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("newest");
  const [page, setPage] = useState(1);
  const targetPage = useRef(null);
  const debouncedSearch = useDebounce(search);
  const params = useMemo(() => ({
    page,
    page_size: 10,
    search: debouncedSearch,
    ordering,
  }), [page, debouncedSearch, ordering]);
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ["admin", "suspicious-vouches", "list", params],
    queryFn: () => fetchSuspiciousVouches(params),
    placeholderData: keepPreviousData,
    retryOnMount: false,
  });
  const items = data?.items ?? [];
  const pagination = data?.pagination;

  function selectVouch(id) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (id) {
        next.set("suspicious_vouch_id", String(id));
      } else {
        next.delete("suspicious_vouch_id");
      }
      return next;
    });
  }

  useEffect(() => {
    if (
      targetPage.current === null || isLoading || isPlaceholderData || error ||
      pagination?.page !== targetPage.current
    ) {
      return;
    }
    const id = data?.items?.[0]?.id;
    targetPage.current = null;
    if (id) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set("suspicious_vouch_id", String(id));
        return next;
      });
    }
  }, [data, pagination?.page, isLoading, isPlaceholderData, error, setSearchParams]);

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
    targetPage.current = null;
    selectVouch(null);
  }

  function changePage(nextPage) {
    targetPage.current = nextPage;
    setPage(nextPage);
    selectVouch(null);
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]">
      <aside aria-label="Suspicious vouch list" className="min-w-0 border-b border-stroke lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-stroke p-4">
          <h2 className="text-base font-semibold text-text-primary">Suspicious Vouches</h2>
          <p className="text-sm text-text-secondary">Flagged submissions, including withdrawn and invalid evidence.</p>
          <label className="block">
            <span className="sr-only">Search suspicious vouches</span>
            <input type="search" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} placeholder="Search accounts, businesses, specialties" className="w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-stroke-active" />
          </label>
          <SortMenu value={ordering} options={SORT_OPTIONS} onChange={(value) => changeFilter(setOrdering, value)} ariaLabel="Sort suspicious vouches" />
        </div>
        <div aria-busy={isLoading || isFetching} className="lg:max-h-[calc(100vh-400px)] lg:overflow-y-auto">
          {isLoading || isPlaceholderData ? (
            <ModerationQueueSkeleton label="Loading suspicious vouches" />
          ) : error ? (
            <DataErrorState title="Unable to load suspicious vouches" message="The advisory list could not be loaded." onRetry={refetch} />
          ) : items.length ? items.map((vouch) => (
            <button key={vouch.id} type="button" aria-pressed={selectedId === vouch.id} onClick={() => selectVouch(vouch.id)} className={`w-full cursor-pointer space-y-2 border-b border-l-[3px] border-stroke p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-info ${selectedId === vouch.id ? "border-l-info bg-info/5" : "border-l-transparent hover:bg-interaction-hover"}`}>
              <span className="flex items-center gap-2">
                <UserAvatar avatarUrl={vouch.author.avatar_url} avatarKey={vouch.author.avatar_key} size="queue" />
                <span className="min-w-0 truncate text-sm font-semibold text-text-primary">{authorName(vouch.author)}</span>
              </span>
              <span className="block text-sm text-text-primary">{vouch.business.name} · {vouch.specialty.name}</span>
              <span className="block text-xs text-text-secondary">Vouch #{vouch.id} · {formatDateTime(vouch.submitted_at)}</span>
              {vouch.detected_at && (
                <span className="block text-xs text-text-secondary">Detected {formatDateTime(vouch.detected_at)}</span>
              )}
              <span className="inline-flex rounded-lg border border-stroke bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">{reasonLabel(vouch.reasons)}</span>
              <SupportState vouch={vouch} />
            </button>
          )) : (
            <div className="p-8 text-center text-text-secondary">
              <Inbox className="mx-auto h-8 w-8" aria-hidden="true" />
              <p className="mt-3 font-medium text-text-primary">No suspicious vouches found</p>
              <p className="mt-1 text-sm">Only advisory flags appear here. Try another search.</p>
            </div>
          )}
        </div>
        {pagination?.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-stroke px-4 py-3 text-sm text-text-secondary">
            <button type="button" disabled={isFetching || !pagination.has_previous} onClick={() => changePage(page - 1)} className="disabled:opacity-40">Previous</button>
            <span>Page {pagination.page} of {pagination.total_pages}</span>
            <button type="button" disabled={isFetching || !pagination.has_next} onClick={() => changePage(page + 1)} className="disabled:opacity-40">Next</button>
          </div>
        )}
      </aside>
      <main aria-label="Suspicious vouch investigation" className="min-w-0">
        <VouchDetail
          key={selectedId}
          vouchId={selectedId}
          onStale={() => {
            selectVouch(null);
            refetch();
          }}
        />
      </main>
    </div>
  );
}
