import {
  Info,
  LayoutDashboard,
  MessageSquareText,
  Store,
  ThumbsUp,
  Users,
} from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import MetricCard from "../../components/MetricCard";
import { formatCount } from "../../analytics/utils/presentation";
import DashboardQuerySection from "./DashboardQuerySection";
import BusinessStatusDonut from "./BusinessStatusDonut";
import AccountStatusDonut from "./AccountStatusDonut";

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
      icon: ThumbsUp,
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
                value={formatCount(metric.value(data))}
                measurementLabel={metric.scope}
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
