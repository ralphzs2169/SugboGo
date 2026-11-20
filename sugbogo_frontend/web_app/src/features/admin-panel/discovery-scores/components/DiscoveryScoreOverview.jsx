import { CircleCheck, ClipboardList, Store, TriangleAlert } from "lucide-react";
import MetricCard from "../../components/MetricCard";
import MetricCardsSkeleton from "../../components/MetricCardsSkeleton";
import { LoadGroupFeedback } from "../../components/PageLoadFeedback";
import { useDiscoveryScoreAnalytics } from "../../analytics/hooks/useAnalyticsReports";
import { formatCount, formatTimestamp } from "../../analytics/utils/presentation";

/** Render active-business health independently of list filters and table failures. */
export default function DiscoveryScoreOverview() {
  const query = useDiscoveryScoreAnalytics({ page_size: 1 });
  const coverage = query.data?.coverage;


  if (query.isLoading && !coverage) return <MetricCardsSkeleton count={4} />;

  const metrics = [
    {
      title: "Scored Businesses", icon: Store, value: formatCount(coverage?.computed),
      description: "Businesses with a computed score",
    },
    {
      title: "Up-to-Date Scores", icon: CircleCheck, value: formatCount(coverage?.fresh),
      description: "Within the expected refresh interval",
    },
    {
      title: "Refresh Failures", icon: TriangleAlert,
      value: <span className={coverage?.failed > 0 ? "text-danger" : ""}>{formatCount(coverage?.failed)}</span>,
      description: "Latest refresh attempt failed",
    },
    {
      title: "Businesses Needing Attention", icon: ClipboardList,
      value: formatCount(coverage?.needs_attention),
      description: "Businesses with failed refreshes or outdated scores",
    },
  ];

  return (
    <div aria-busy={query.isFetching}>
      <div className="[&:not(:empty)]:mb-3">
        <LoadGroupFeedback
          section="overview"
          label="Discovery Score overview"
          retryLabel="Retry overview"
          queries={[query]}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.title} wrapTitle title={metric.title} icon={metric.icon}
            value={metric.value} footerValue={metric.description}
          />
        ))}
      </div>
      {coverage?.snapshot_at && (
        <p className="mt-2 text-xs text-text-secondary">
          As of {formatTimestamp(coverage.snapshot_at)} · PHT · Active businesses
          {query.isFetching && <span role="status"> · Refreshing overview…</span>}
        </p>
      )}
    </div>
  );
}
