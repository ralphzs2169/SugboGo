import MetricCard from "@/features/admin-panel/components/MetricCard";

function getTrend(trend, positiveDirection = "up") {
  if (!trend) {
    return null;
  }

  if (trend.direction === "unchanged") {
    return {
      variant: "neutral",
      direction: "unchanged",
      value: "No change",
    };
  }

  const isPositive = trend.direction === positiveDirection;

  const unitSuffix = trend.unit === "percentage_points" ? " pts" : "";

  return {
    variant: isPositive ? "success" : "danger",
    direction: trend.direction,
    value: `${trend.direction === "up" ? "+" : "-"}${trend.value}${unitSuffix}`,
  };
}

/**
 * Displays the primary merchant application KPIs for administrators.
 *
 * The cards focus on review workload, approval performance,
 * SLA compliance, and resubmission activity.
 */
export default function BusinessApplicationMetrics({
  pendingReview,
  approvalRate,
  resubmissionRate,
  slaComplianceRate,
  pendingReviewThisWeek,
  approvalRateTrend,
  resubmissionRateTrend,
  slaComplianceRateTrend,
  pendingReviewHistory,
  approvalRateHistory,
  resubmissionRateHistory,
  slaComplianceRateHistory,
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Pending review KPI */}
      <MetricCard
        title="Pending Review"
        value={pendingReview}
        footerValue={
          pendingReviewThisWeek === 0
            ? "0 this week"
            : `+${pendingReviewThisWeek} this week`
        }
        sparklineData={pendingReviewHistory}
        sparklineValueFormatter={(value) => [value, "Pending Review"]}
      />

      {/* Approval rate KPI */}
      <MetricCard
        title="Approval Rate"
        value={
          approvalRate === null || approvalRate === undefined
            ? "—"
            : `${approvalRate}%`
        }
        trend={getTrend(approvalRateTrend, "up")}
        sparklineData={approvalRateHistory}
        sparklineValueFormatter={(value) => [`${value}%`, "Approval Rate"]}
      />

      {/* Resubmission rate KPI */}
      <MetricCard
        title="Resubmission Rate"
        value={
          resubmissionRate === null || resubmissionRate === undefined
            ? "—"
            : `${resubmissionRate}%`
        }
        trend={getTrend(resubmissionRateTrend, "down")}
        sparklineData={resubmissionRateHistory}
        sparklineValueFormatter={(value) => [`${value}%`, "Resubmission Rate"]}
      />
      {/* SLA compliance KPI */}
      <MetricCard
        title="SLA Compliance"
        value={
          slaComplianceRate === null || slaComplianceRate === undefined
            ? "—"
            : `${slaComplianceRate}%`
        }
        trend={getTrend(slaComplianceRateTrend, "up")}
        sparklineData={slaComplianceRateHistory}
        sparklineValueFormatter={(value) => [`${value}%`, "SLA Compliance"]}
      />
    </div>
  );
}
