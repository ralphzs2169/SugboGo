import {
  Heart,
  Info,
  LayoutDashboard,
  MessageSquareText,
  Minus,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import MetricCard from "../../components/MetricCard";
import { formatCount } from "../../analytics/utils/presentation";
import DashboardQuerySection from "./DashboardQuerySection";
import BusinessStatusDonut from "./BusinessStatusDonut";
import AccountStatusDonut from "./AccountStatusDonut";

/** Show inline activity comparisons with red emphasis for declining volume. */
function ActivityValue({ current, previous }) {
  const available = [current, previous].every((value) => Number.isInteger(value) && value >= 0);
  const difference = available ? current - previous : null;
  const Icon = difference > 0 ? TrendingUp : difference < 0 ? TrendingDown : Minus;
  const label = difference === null ? "Comparison unavailable" : difference === 0
    ? "No change" : `${formatCount(Math.abs(difference))} ${difference > 0 ? "more" : "fewer"}`;
  return (
    <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {/* Analytics-style value and inline comparison */}
      <span className="font-semibold tabular-nums">{formatCount(current)}</span>
      <span className={`inline-flex items-center gap-1 text-sm font-medium ${difference < 0 ? "text-danger" : "text-text-secondary"}`}>
        {available && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
        <span>{label}</span>
      </span>
    </span>
  );
}

/** Present verified activity and inventory using standard shared Admin metric cards and independent source recovery. */
export default function PlatformOverviewKpis({
  overview,
  summary,
  informationAction,
}) {
  const metrics = [
    {
      label: "Active Accounts",
      key: "active_accounts",
      query: overview,
      icon: Users,
      scope: "Current count",
      value: (data) => data.active_accounts,
      help: "Accounts with active status assigned the Explorer or Merchant role. This is not a measure of recent engagement.",
    },
    {
      label: "Active Businesses",
      key: "active_businesses",
      query: summary,
      icon: Store,
      scope: "Current count",
      value: (data) => data.active_businesses,
    },
    {
      label: "Reviews Published",
      key: "reviews_published",
      query: overview,
      icon: MessageSquareText,
      scope: "Last 7 days",
      value: (data) => data.activity?.reviews_published,
    },
    {
      label: "Vouches Created",
      key: "vouches_created",
      query: overview,
      icon: Heart,
      scope: "Last 7 days",
      value: (data) => data.activity?.vouches_created,
    },
  ];
  return (
    <section aria-label="Platform Overview" className="min-w-0">
      {/* Shared Admin metrics keep current inventory distinct from period activity */}
      <div className="mb-3 flex items-center gap-1">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <LayoutDashboard aria-hidden="true" className="h-4 w-4 shrink-0" />
          Platform Overview
        </h2>
        {informationAction}
      </div>
      <p className="-mt-2 mb-3 text-xs text-text-secondary">
        Reviews and vouches · Last 7 days · PHT
      </p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardQuerySection
            key={metric.key}
            query={metric.query}
            label={metric.label}
            headerVisible={false}
            framed={false}
          >
            {(data) => (
              <MetricCard
                wrapTitle
                title={metric.label}
                icon={metric.icon}
                value={metric.scope === "Last 7 days" ? (
                  <ActivityValue current={metric.value(data)} previous={data.activity?.previous?.[metric.key]} />
                ) : formatCount(metric.value(data))}
                measurementLabel={metric.scope === "Last 7 days" ? (
                  <span>Prev. period: {formatCount(data.activity?.previous?.[metric.key])}</span>
                ) : metric.scope}
                visualization={
                  metric.key === "active_businesses" ? (
                    <BusinessStatusDonut status={data.business_status} />
                  ) : metric.key === "active_accounts" ? (
                    <AccountStatusDonut
                      activeCount={data.active_accounts}
                      distribution={data.user_distribution}
                    />
                  ) : undefined
                }
                headerAction={
                  metric.help && (
                    <Tooltip
                      content={metric.help}
                      asChild
                      place="top"
                      openOnClick
                      closeEvents={{ blur: true }}
                      globalCloseEvents={{
                        escape: true,
                        clickOutsideAnchor: true,
                        scroll: true,
                        resize: true,
                      }}
                      className="!z-50 max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal !px-3 !py-2 leading-relaxed"
                    >
                      <button
                        type="button"
                        aria-label={`About ${metric.label}`}
                        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
                      >
                        <Info aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  )
                }
              />
            )}
          </DashboardQuerySection>
        ))}
      </div>
    </section>
  );
}
