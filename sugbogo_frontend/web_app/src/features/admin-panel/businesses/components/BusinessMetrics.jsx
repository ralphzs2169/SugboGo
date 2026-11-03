import { Ban, Building2, ClipboardList, Minus, Store, TrendingDown, TrendingUp } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import MetricCard from "../../components/MetricCard";
import DashboardSkeleton from "../../dashboard/components/DashboardSkeleton";
import { formatCount, formatTimestamp } from "../../analytics/utils/presentation";
import useBusinessOverview from "../hooks/useBusinessOverview";

const GRID = "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
const TITLES = [
  "Total Businesses",
  "Suspended Businesses",
  "New Businesses",
  "Pending Business Updates",
];

/** Present the provided additions comparison only for valid equal-elapsed windows. */
function AdditionsComparison({ additions, contextOnly = false }) {
  const available = additions?.comparison_available === true
    && Number.isInteger(additions.count)
    && Number.isInteger(additions.previous_count)
    && additions.count >= 0
    && additions.previous_count >= 0
    && additions.difference === additions.count - additions.previous_count;

  if (!available) {
    return null;
  }

  if (contextOnly) {
    return (
      <span>Prev. equivalent period: {formatCount(additions.previous_count)}</span>
    );
  }

  const difference = additions.difference;
  const Icon = difference > 0 ? TrendingUp : difference < 0 ? TrendingDown : Minus;
  const label = difference === 0
    ? "No change"
    : `${formatCount(Math.abs(difference))} ${difference > 0 ? "more" : "fewer"}`;

  return (
    <span
      className={
        "inline-flex items-center gap-1 text-sm font-medium " +
        (difference < 0 ? "text-danger" : "text-text-secondary")
      }
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/** Present live directory counts with independent recovery and retained refresh data. */
export default function BusinessMetrics() {
  const overview = useBusinessOverview();
  const [searchParams] = useSearchParams();
  const hasData = overview.data != null;
  const suspendedParams = new URLSearchParams(searchParams);
  suspendedParams.set("status", "suspended");
  suspendedParams.delete("page");
  suspendedParams.delete("tab");

  useApiErrorNotification(overview.error, {
    toastId: "business-overview-load-error",
    fallbackMessage: "Unable to load business overview. Please try again.",
  });

  const data = overview.data;
  const metrics = hasData ? [
    {
      title: TITLES[0],
      icon: Building2,
      count: data.business_status?.total,
      supporting: `${formatCount(data.business_status?.active)} active businesses`,
    },
    {
      title: TITLES[1],
      icon: Ban,
      count: data.business_status?.suspended,
      supporting: "Currently suspended",
      to: `/admin-panel/businesses?${suspendedParams}`,
    },
    {
      title: TITLES[2],
      icon: Store,
      count: data.new_businesses?.count,
      comparison: <AdditionsComparison additions={data.new_businesses} />,
      comparisonContext: (
        <AdditionsComparison additions={data.new_businesses} contextOnly />
      ),
    },
    {
      title: TITLES[3],
      icon: ClipboardList,
      count: data.change_requests?.pending_total,
      supporting: "Awaiting review",
      to: "/admin-panel/businesses/update-requests?type=all&status=pending",
    },
  ] : [];

  return (
    <div aria-busy={overview.isFetching}>
      {overview.error && (
        <DataErrorState
          compact
          framed
          detectOffline
          retainedData={hasData}
          title="Unable to load business overview"
          message="We couldn't retrieve the latest business metrics."
          onRetry={() => overview.refetch()}
          retrying={overview.isFetching}
          retryLabel="Retry"
        />
      )}
      {overview.isLoading && !hasData && (
        <div className={GRID}>
          {TITLES.map((title) => (
            <DashboardSkeleton key={title} label={title} variant="activity" />
          ))}
        </div>
      )}
      {hasData && (
        <>
          <div className={GRID}>
            {metrics.map((metric) => {
              const card = (
                <MetricCard
                  wrapTitle
                  title={metric.title}
                  icon={metric.icon}
                  value={metric.comparison ? (
                    <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="text-4xl font-semibold tabular-nums">
                        {formatCount(metric.count)}
                      </span>
                      {metric.comparison}
                    </span>
                  ) : (
                    <span className="text-4xl tabular-nums">
                      {formatCount(metric.count)}
                    </span>
                  )}
                  footerValue={metric.supporting}
                  measurementLabel={metric.comparisonContext}
                />
              );

              return metric.to ? (
                <Link
                  key={metric.title}
                  to={metric.to}
                  aria-label={`${metric.title}: ${formatCount(metric.count)}. View ${metric.title.toLowerCase()}`}
                  className="min-w-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info [&>div]:h-full hover:[&>div]:border-text-secondary"
                >
                  {card}
                </Link>
              ) : <div key={metric.title} className="min-w-0 [&>div]:h-full">{card}</div>;
            })}
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            As of {formatTimestamp(data.as_of)} · PHT
            {overview.isFetching && <span role="status"> · Refreshing business overview…</span>}
          </p>
        </>
      )}
    </div>
  );
}
