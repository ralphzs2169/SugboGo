import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Clock3, FilePenLine, Hourglass } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import MetricCard from "../../components/MetricCard";
import MetricCardsSkeleton from "../../components/MetricCardsSkeleton";
import {
  fetchUpdateRequestMetrics,
  updateRequestSummaryKey,
} from "../services/updateRequestMetricsService";

/** Format the oldest pending request's recorded elapsed wait. */
function formatWait(seconds) {
  if (seconds == null) {
    return "—";
  }
  if (seconds < 60) {
    return "<1 min";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hr`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Display scoped update-request workload with the shared standard metric cards. */
export default function UpdateRequestMetrics({
  requestType,
  typeLabel,
  businessId,
  onFilterQueue,
  onOpenRequest,
}) {
  const params = { request_type: requestType, business_id: businessId };
  const query = useQuery({
    queryKey: [...updateRequestSummaryKey, params],
    queryFn: () => fetchUpdateRequestMetrics(params),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retryOnMount: false,
  });
  const data = query.data;
  const oldest = data?.oldest_pending;
  const metrics = [
    {
      title: "Pending Requests",
      icon: ClipboardList,
      value: data?.pending,
      description: "Awaiting an admin decision",
      action: () => onFilterQueue("pending"),
    },
    {
      title: "Oldest Pending",
      icon: Hourglass,
      value: data ? formatWait(oldest?.seconds) : undefined,
      description: data?.pending === 0 ? "No pending requests" : "Longest wait since submission",
      action: oldest ? () => onOpenRequest(oldest) : undefined,
    },
    {
      title: "Aging Requests",
      icon: Clock3,
      value: data?.aging_requests,
      description: `${data?.aging_threshold_hours ?? 48}+ elapsed hours pending`,
      action: () => onFilterQueue("aging"),
      warning: data?.aging_requests > 0,
    },
    {
      title: "Resolved Today",
      icon: CheckCircle2,
      value: data?.resolved_today,
      description: "Approved or rejected since midnight · PHT",
      action: () => onFilterQueue("resolved_today"),
    },
  ];

  return (
    <section className="mb-8" aria-label="Update request overview" aria-busy={query.isFetching}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
        <FilePenLine aria-hidden="true" className="h-4 w-4 shrink-0" />
        Update Request Overview
      </h2>
      <p className="-mt-2 mb-3 text-xs text-text-secondary">
        {typeLabel}{businessId ? ` · Business #${businessId}` : " · All businesses"} · PHT
      </p>
      {query.error && (
        <DataErrorState
          compact
          framed
          retainedData={Boolean(data)}
          title="Unable to load update request metrics"
          message="The request queue is still available. Retry to load its summary."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}
      {query.isPending && !query.isError ? <MetricCardsSkeleton /> : (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            let value = metric.value;
            if (value != null) {
              value = (
                <span className={`text-4xl tabular-nums${metric.warning ? " text-warning" : ""}`}>
                  {value}
                </span>
              );
            }
            const card = (
              <MetricCard
                wrapTitle
                title={metric.title}
                icon={metric.icon}
                value={value}
                footerValue={metric.description}
              />
            );
            if (!data || !metric.action) {
              return <div key={metric.title} className="min-w-0 [&>div]:h-full">{card}</div>;
            }
            return (
              <button
                key={metric.title}
                type="button"
                aria-label={`${metric.title}: ${metric.value}. ${metric.title === "Oldest Pending" ? "Open request" : "Filter queue"}`}
                onClick={metric.action}
                className="min-w-0 cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info [&>div]:h-full hover:[&>div]:border-text-secondary"
              >
                {card}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-text-secondary">
        Totals across all pages within this scope, independent of search and status filters.
        {data && query.isFetching && <span role="status"> Refreshing metrics…</span>}
      </p>
    </section>
  );
}
