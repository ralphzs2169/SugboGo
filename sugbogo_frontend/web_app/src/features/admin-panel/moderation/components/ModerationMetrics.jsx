import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Clock3, Hourglass, ShieldCheck } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import MetricCard from "../../components/MetricCard";
import { fetchModerationMetrics } from "../services/moderationMetricsService";

/** Express elapsed queue age without implying a response SLA. */
function formatQueueAge(seconds) {
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

/** Present the active tab's workload with shared cards and existing title styles. */
export default function ModerationMetrics({
  tab,
  tabLabel,
  onSelectQueue,
}) {
  const query = useQuery({
    queryKey: ["admin", "moderation-summary", tab],
    queryFn: () => fetchModerationMetrics(tab),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retryOnMount: false,
  });
  useApiErrorNotification(query.error, {
    toastId: "admin-moderation-metrics-load-error",
    fallbackMessage: "Unable to load moderation metrics. Please try again.",
  });

  const data = query.data;
  const loading = query.isPending && !query.isError;
  const advisory = tab === "suspicious";
  const oldest = data?.oldest_pending;
  let oldestDescription = "Queue entry time unavailable";
  if (oldest) {
    oldestDescription = advisory
      ? "Since the signal was recorded"
      : "Longest wait in this queue";
  } else if (data?.pending === 0) {
    oldestDescription = "No pending cases";
  }
  const metrics = [
    {
      title: "Awaiting Decision",
      icon: ClipboardList,
      value: data?.pending,
      description: advisory
        ? "Flagged items for investigation"
        : "All unresolved cases in this tab",
      action: "pending",
      actionLabel: "Show all pending cases",
    },
    {
      title: "Oldest Pending",
      icon: Hourglass,
      value: data ? formatQueueAge(oldest?.seconds) : undefined,
      description: oldestDescription,
      action: oldest ? "oldest" : undefined,
      actionLabel: "Open the oldest case",
    },
    {
      title: "Aging Cases",
      icon: Clock3,
      value: data?.aging_cases,
      description: `${data?.aging_threshold_hours ?? 48}+ elapsed hours in this queue`,
      action: "aging",
      actionLabel: "Show aging cases",
      warning: data?.aging_cases > 0,
    },
    {
      title: "Resolved Today",
      icon: CheckCircle2,
      value: data && advisory ? "Not tracked" : data?.resolved_today,
      description: advisory
        ? "Advisory signals have no resolution action"
        : "Decisions since midnight · Philippine time",
    },
  ];

  return (
    <section
      className="mb-6"
      aria-label={`${tabLabel} metrics`}
      aria-busy={query.isFetching}
    >
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-text-primary">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
        Moderation Overview
      </h2>
      <p className="mb-3 text-xs text-text-secondary">
        {tabLabel} workload and decisions today · PHT
      </p>
      {query.error && (
        <DataErrorState
          compact
          framed
          retainedData={Boolean(data)}
          title="Unable to load moderation metrics"
          message="The moderation queue is still available. Retry to load its summary."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          let value = metric.value;
          if (loading) {
            value = (
              <span
                aria-label="Loading metric"
                className="block h-9 w-20 rounded bg-skeleton motion-safe:animate-pulse"
              />
            );
          } else if (metric.warning) {
            value = <span className="tabular-nums text-warning">{metric.value}</span>;
          }
          const card = (
            <MetricCard
              wrapTitle
              title={metric.title}
              icon={metric.icon}
              value={value}
              footerValue={loading ? "Loading…" : metric.description}
            />
          );
          if (!data || !metric.action) {
            return (
              <div key={metric.title} className="min-w-0 [&>div]:h-full">
                {card}
              </div>
            );
          }
          return (
            <button
              key={metric.title}
              type="button"
              aria-label={`${metric.title}: ${metric.value}. ${metric.actionLabel}`}
              onClick={() => onSelectQueue(metric.action, oldest)}
              className="min-w-0 cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info [&>div]:h-full hover:[&>div]:border-text-secondary"
            >
              {card}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        {tabLabel} totals across all pages, independent of queue filters.
        {advisory && " Suspicious totals include review and vouch findings."}
        {data?.unknown_age_count > 0 && (
          <span> {data.unknown_age_count} with unrecorded entry times excluded from age metrics.</span>
        )}
        {data && query.isFetching && <span role="status"> Refreshing metrics…</span>}
      </p>
    </section>
  );
}
