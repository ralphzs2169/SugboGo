import { Store, UserCheck, UsersRound, UserX } from "lucide-react";


import { formatCount } from "../../analytics/utils/presentation";
import { LoadGroupFeedback } from "../../components/PageLoadFeedback";
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

function UserOverviewCard({ metric, query }) {
  if (query.isLoading && query.data === undefined) {
    return <DashboardSkeleton label={metric.title} variant="activity" />;
  }

  return (
    <MetricCard
      wrapTitle
      title={metric.title}
      icon={metric.icon}
      value={query.data === undefined ? undefined : (
        <span className="text-4xl tabular-nums">
          {formatCount(query.data)}
        </span>
      )}
      footerValue={metric.description}
    />
  );
}

/** Shows current account inventory independently of directory filters. */
export default function UserOverview() {
  const overview = useUserOverview();

  return (
    <div className="space-y-3">
      <LoadGroupFeedback
        section="overview"
        label="User counts"
        retryLabel="Retry user counts"
        queries={Object.values(overview)}
      />
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <div key={metric.key} className="min-w-0">
            <UserOverviewCard metric={metric} query={overview[metric.key]} />
          </div>
        ))}
      </div>
    </div>
  );
}
