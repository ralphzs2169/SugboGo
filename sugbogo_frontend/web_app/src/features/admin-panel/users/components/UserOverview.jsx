import { Store, UserCheck, UsersRound, UserX } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import { formatCount } from "../../analytics/utils/presentation";
import MetricCard from "../../components/MetricCard";
import DashboardSkeleton from "../../dashboard/components/DashboardSkeleton";
import useUserOverview from "../hooks/useUserOverview";

const METRICS = [
  {
    key: "total",
    title: "Total Users",
    icon: UsersRound,
    description: "All retained accounts",
  },
  {
    key: "active",
    title: "Active Users",
    icon: UserCheck,
    description: "Active accounts across all roles",
  },
  {
    key: "merchants",
    title: "Merchants",
    icon: Store,
    description: "Assigned merchant role · all statuses",
  },
  {
    key: "suspended",
    title: "Suspended Users",
    icon: UserX,
    description: "Currently suspended accounts",
  },
];

/** Preserves each count independently with request-specific error recovery. */
function UserOverviewCard({ metric, query }) {
  const hasData = query.data !== undefined;

  useApiErrorNotification(query.error, {
    toastId: `admin-users-overview-${metric.key}-error`,
    fallbackMessage: `Unable to load ${metric.title.toLowerCase()}. Please try again.`,
  });

  return (
    <div className="min-w-0" aria-busy={query.isFetching}>
      {query.error && (
        <DataErrorState
          compact
          framed
          detectOffline
          retainedData={hasData}
          refreshLabel={metric.title}
          title={`Unable to load ${metric.title.toLowerCase()}`}
          message="This account count could not be loaded. Please try again."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
          retryLabel="Retry"
        />
      )}
      {query.isLoading && !hasData && (
        <DashboardSkeleton label={metric.title} variant="activity" />
      )}
      {hasData && (
        <MetricCard
          wrapTitle
          title={metric.title}
          icon={metric.icon}
          value={(
            <span className="text-4xl tabular-nums">
              {formatCount(query.data)}
            </span>
          )}
          footerValue={metric.description}
        />
      )}
    </div>
  );
}

/** Shows current account inventory independently of directory filters. */
export default function UserOverview() {
  const overview = useUserOverview();

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {METRICS.map((metric) => (
        <UserOverviewCard
          key={metric.key}
          metric={metric}
          query={overview[metric.key]}
        />
      ))}
    </div>
  );
}
