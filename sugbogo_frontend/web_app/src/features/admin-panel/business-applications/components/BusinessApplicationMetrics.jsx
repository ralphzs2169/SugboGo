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
  isError = false,
}) {
  const unavailable = isError ? "—" : null;

  const pendingReviewValue = unavailable ?? pendingReview ?? "—";

  const pendingReviewFooter = isError
    ? "Unable to load"
    : pendingReviewThisWeek == null
      ? "—"
      : pendingReviewThisWeek === 0
        ? "0 this week"
        : `+${pendingReviewThisWeek} this week`;

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Pending review KPI */}
      <MetricCard
        title="Pending Review"
        value={pendingReviewValue}
        footerValue={pendingReviewFooter}
        sparklineData={isError ? [] : pendingReviewHistory}
        sparklineValueFormatter={(value) => [value, "Pending Review"]}
      />

      {/* Approval rate KPI */}
      <MetricCard
        title="Approval Rate"
        value={isError || approvalRate == null ? "—" : `${approvalRate}%`}
        trend={isError ? null : getTrend(approvalRateTrend, "up")}
        sparklineData={isError ? [] : approvalRateHistory}
        sparklineValueFormatter={(value) => [`${value}%`, "Approval Rate"]}
      />

      {/* Resubmission rate KPI */}
      <MetricCard
        title="Resubmission Rate"
        value={
          isError || resubmissionRate == null ? "—" : `${resubmissionRate}%`
        }
        trend={isError ? null : getTrend(resubmissionRateTrend, "down")}
        sparklineData={isError ? [] : resubmissionRateHistory}
        sparklineValueFormatter={(value) => [`${value}%`, "Resubmission Rate"]}
      />

      {/* SLA compliance KPI */}
      <MetricCard
        title="SLA Compliance"
        value={
          isError || slaComplianceRate == null ? "—" : `${slaComplianceRate}%`
        }
        trend={isError ? null : getTrend(slaComplianceRateTrend, "up")}
        sparklineData={isError ? [] : slaComplianceRateHistory}
        sparklineValueFormatter={(value) => [`${value}%`, "SLA Compliance"]}
      />
    </div>
  );
}
