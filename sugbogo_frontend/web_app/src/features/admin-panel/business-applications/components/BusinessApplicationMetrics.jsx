import MetricCard from "@/features/admin-panel/components/MetricCard";

function getTrendBadge(trend, positiveDirection = "up") {
  if (!trend) {
    return null;
  }

  if (trend.direction === "unchanged") {
    return {
      variant: "neutral",
      text: "No change",
    };
  }

  const isPositive = trend.direction === positiveDirection;

  return {
    variant: isPositive ? "success" : "danger",
    text: `${trend.direction === "up" ? "+" : "-"}${trend.value}${
      trend.unit === "percentage_points" ? " pp" : ""
    }`,
  };
}

/**
 * Displays the primary merchant application KPIs for administrators.
 *
 * The cards focus on review workload, approval performance, SLA compliance,
 * and overall application volume.
 */
export default function BusinessApplicationMetrics({
  pendingReview,
  approvalRate,
  slaComplianceRate,
  totalApplications,
  pendingReviewTrend,
  approvalRateTrend,
  slaComplianceRateTrend,
}) {
  const pendingTrend = getTrendBadge(pendingReviewTrend, "down");

  const approvalTrend = getTrendBadge(approvalRateTrend, "up");

  const slaTrend = getTrendBadge(slaComplianceRateTrend, "up");

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Pending review KPI */}
      <MetricCard
        title="Pending Review"
        value={pendingReview}
        badgeVariant={pendingTrend?.variant}
        badgeText={pendingTrend?.text}
        secondaryLabel="Awaiting administrator review"
      />

      {/* Approval rate KPI */}
      <MetricCard
        title="Approval Rate"
        value={
          approvalRate === null || approvalRate === undefined
            ? "—"
            : `${approvalRate}%`
        }
        badgeVariant={approvalTrend?.variant}
        badgeText={approvalTrend?.text}
        secondaryLabel="Of decided applications"
      />

      {/* SLA compliance KPI */}
      <MetricCard
        title="SLA Compliance"
        value={
          slaComplianceRate === null || slaComplianceRate === undefined
            ? "—"
            : `${slaComplianceRate}%`
        }
        badgeVariant={slaTrend?.variant}
        badgeText={slaTrend?.text}
        secondaryLabel="Reviewed within SLA"
      />

      {/* Total applications KPI */}
      <MetricCard
        title="Total Applications"
        value={totalApplications}
        secondaryLabel="All applications"
      />
    </div>
  );
}
