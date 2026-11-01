import {
  ClipboardList,
  MessageSquareText,
  Store,
  ThumbsUp,
} from "lucide-react";
import MetricCard from "../../components/MetricCard";
import { formatCount } from "../../analytics/utils/presentation";
import DashboardQuerySection from "./DashboardQuerySection";

/** Present verified activity and inventory using standard shared Admin metric cards and independent source recovery. */
export default function PlatformOverviewKpis({ overview, summary }) {
  const metrics = [
    {
      label: "Applications Submitted",
      key: "applications_submitted",
      query: overview,
      icon: ClipboardList,
      scope: "Last 7 days",
    },
    {
      label: "Active Businesses",
      key: "active_businesses",
      query: summary,
      icon: Store,
      scope: "Current count",
    },
    {
      label: "Reviews Published",
      key: "reviews_published",
      query: overview,
      icon: MessageSquareText,
      scope: "Last 7 days",
    },
    {
      label: "Vouches Created",
      key: "vouches_created",
      query: overview,
      icon: ThumbsUp,
      scope: "Last 7 days",
    },
  ];
  return (
    <section aria-label="Platform Overview" className="min-w-0">
      {/* Shared Admin metrics keep current inventory distinct from period activity */}
      <h2 className="mb-3 text-base font-semibold text-text-primary">
        Platform Overview
      </h2>
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
                value={formatCount(
                  metric.key === "active_businesses"
                    ? data.active_businesses
                    : data.activity?.[metric.key],
                )}
                measurementLabel={metric.scope}
              />
            )}
          </DashboardQuerySection>
        ))}
      </div>
    </section>
  );
}
