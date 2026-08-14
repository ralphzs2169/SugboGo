import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import BusinessApplicationManagementPanel from "../business-applications/components/BusinessApplicationManagementPanel";
import useBusinessApplicationStatistics from "../business-applications/hooks/useBusinessApplicationStatistics";
import BusinessApplicationMetrics from "../business-applications/components/BusinessApplicationMetrics";
import ApplicationReviewSlaInfo from "../business-applications/components/ApplicationReviewSlaInfo";
import ApplicationMetricsSkeleton from "../business-applications/components/skeleton/ApplicationsMetricsSkeleton";
import ApplicationReviewSlaInfoSkeleton from "../business-applications/components/skeleton/ApplicationReviewSlaInfoSkeleton";

export default function BusinessApplicationsPage() {
  useDocumentTitle("Business Applications | SugboGo Admin");

  const { statistics, isLoading: isStatisticsLoading } =
    useBusinessApplicationStatistics();

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
            href: "/admin",
          },
          {
            label: "Management",
            href: "/admin/businesses/applications",
          },
          {
            label: "Applications",
          },
        ]}
        title="Merchant Applications"
      />

      {/* Application overview */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Application Overview
        </h2>

        {!isStatisticsLoading && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span>{statistics.total_applications} applications</span>

            <span className="text-stroke">·</span>

            <span className="text-emerald-500">
              {statistics.approved} approved
            </span>

            <span className="text-stroke">·</span>

            <span className="text-rose-500">
              {statistics.rejected} rejected
            </span>

            <span className="text-stroke">·</span>

            <span>{statistics.pending_review} pending</span>
          </div>
        )}
      </div>

      {/* Application metrics */}
      {isStatisticsLoading ? (
        <ApplicationMetricsSkeleton />
      ) : (
        <BusinessApplicationMetrics
          pendingReview={statistics.pending_review}
          approvalRate={statistics.approval_rate}
          resubmissionRate={statistics.resubmission_rate}
          slaComplianceRate={statistics.sla_compliance_rate}
          pendingReviewThisWeek={statistics.pending_review_this_week}
          approvalRateTrend={statistics.approval_rate_trend}
          resubmissionRateTrend={statistics.resubmission_rate_trend}
          slaComplianceRateTrend={statistics.sla_compliance_rate_trend}
          pendingReviewHistory={statistics.pending_review_history}
          approvalRateHistory={statistics.approval_rate_history}
          resubmissionRateHistory={statistics.resubmission_rate_history}
          slaComplianceRateHistory={statistics.sla_compliance_rate_history}
        />
      )}

      {/* Review SLA information */}
      {isStatisticsLoading ? (
        <ApplicationReviewSlaInfoSkeleton />
      ) : (
        <ApplicationReviewSlaInfo
          slaBusinessDays={statistics.review_sla_business_days}
          approachingBusinessDays={
            statistics.review_sla_approaching_business_days
          }
        />
      )}

      {/* Application management */}
      <BusinessApplicationManagementPanel />
    </>
  );
}
