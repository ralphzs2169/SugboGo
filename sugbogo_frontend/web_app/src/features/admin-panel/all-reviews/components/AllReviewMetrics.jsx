import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Flag,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import MetricCard from "../../components/MetricCard";
import { formatCount } from "../../analytics/utils/presentation";
import { allReviewSummaryOptions } from "../queries/allReviewQueries";

const METRICS = [
  {
    key: "total_reviews",
    title: "Total Reviews",
    icon: MessageSquareText,
    description: "All retained reviews",
  },
  {
    key: "published",
    title: "Published",
    icon: CheckCircle2,
    description: "Currently published",
  },
  {
    key: "under_review",
    title: "Under Review",
    icon: ShieldCheck,
    description: "Currently held for review",
  },
  {
    key: "reported",
    title: "Reported",
    icon: Flag,
    description: "With any retained report",
  },
];
const GRID = "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** Display independent global metrics with the existing compact, clickable card treatment. */
export default function AllReviewMetrics({ filters, onFilterChange }) {
  const query = useQuery(allReviewSummaryOptions());
  const hasData = query.data != null;

  function metricUpdates(key) {
    if (key === "total_reviews") return { status: "", reported: "" };
    if (key === "reported") return { reported: "true" };
    return { status: key };
  }

  function isActive(key) {
    if (key === "total_reviews") return !filters.status && !filters.reported;
    if (key === "reported") return filters.reported === "true";
    return filters.status === key;
  }

  return (
    <section
      className="mb-8"
      aria-label="Global review metrics"
      aria-busy={query.isFetching}
    >
      {query.error && (
        <DataErrorState
          compact
          framed
          retainedData={hasData}
          title="Unable to load review metrics"
          message="The reviews table is still available. Retry to load the global counts."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}
      {query.isLoading && !hasData && (
        <div className={GRID}>
          {METRICS.map((metric) => (
            <div
              key={metric.key}
              role="status"
              aria-label={`Loading ${metric.title}`}
              className="min-h-32 rounded-xl border border-stroke bg-background p-4"
            >
              <span className="sr-only">Loading {metric.title}</span>
              <div
                aria-hidden="true"
                className="space-y-3 motion-safe:animate-pulse"
              >
                <div className="h-3 w-28 rounded bg-skeleton" />
                <div className="h-8 w-16 rounded bg-skeleton" />
                <div className="h-3 w-32 rounded bg-skeleton" />
              </div>
            </div>
          ))}
        </div>
      )}
      {hasData && (
        <div className={GRID}>
          {METRICS.map((metric) => (
            <button
              key={metric.key}
              type="button"
              aria-pressed={isActive(metric.key)}
              aria-label={`${metric.title}: ${formatCount(query.data[metric.key])}. ${metric.key === "total_reviews" ? "Clear status and reported filters" : `Filter ${metric.title.toLowerCase()}`}`}
              onClick={() => onFilterChange(metricUpdates(metric.key))}
              className="min-w-0 cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info [&>div]:h-full hover:[&>div]:border-text-secondary"
            >
              <MetricCard
                compact
                wrapTitle
                title={metric.title}
                icon={metric.icon}
                value={
                  <span className="tabular-nums">
                    {formatCount(query.data[metric.key])}
                  </span>
                }
                footerValue={metric.description}
              />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-text-secondary">
        Global counts may overlap. Reported includes resolved and withdrawn
        reports.
        {hasData && query.isFetching && (
          <span role="status"> Refreshing metrics…</span>
        )}
      </p>
    </section>
  );
}
