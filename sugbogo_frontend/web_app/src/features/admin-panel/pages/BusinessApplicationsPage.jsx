import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import BusinessApplicationManagementPanel from "../business-applications/components/BusinessApplicationManagementPanel";
import useBusinessApplicationStatistics from "../business-applications/hooks/useBusinessApplicationStatistics";
import BusinessApplicationMetrics from "../business-applications/components/BusinessApplicationMetrics";
import ApplicationReviewSlaInfo from "../business-applications/components/ApplicationReviewSlaInfo";

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
            label: "Business Management",
            href: "/admin/businesses/applications",
          },
          {
            label: "Applications",
          },
        ]}
        title="Business Applications"
      />

      {/* Application metrics */}
      <BusinessApplicationMetrics
        pendingReview={isStatisticsLoading ? "—" : statistics.pending_review}
        approved={isStatisticsLoading ? "—" : statistics.approved}
        rejected={isStatisticsLoading ? "—" : statistics.rejected}
        totalApplications={
          isStatisticsLoading ? "—" : statistics.total_applications
        }
        approvalRate={isStatisticsLoading ? "—" : statistics.approval_rate}
        resubmissionRate={
          isStatisticsLoading ? "—" : statistics.resubmission_rate
        }
        slaComplianceRate={
          isStatisticsLoading ? "—" : statistics.sla_compliance_rate
        }
      />

      {/* Review SLA information */}
      {!isStatisticsLoading && (
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
