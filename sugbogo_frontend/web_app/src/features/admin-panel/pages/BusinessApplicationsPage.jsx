import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import BusinessApplicationManagementPanel from "../business-applications/components/BusinessApplicationManagementPanel";
import useBusinessApplicationStatistics from "../business-applications/hooks/useBusinessApplicationStatistics";
import BusinessApplicationMetrics from "../business-applications/components/BusinessApplicationMetrics";

export default function BusinessApplicationsPage() {
  useDocumentTitle("Business Applications | SugboGo Admin");

  const { statistics, isLoading: isStatisticsLoading } =
    useBusinessApplicationStatistics();

  return (
    <>
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

      <BusinessApplicationMetrics
        pendingReview={isStatisticsLoading ? "—" : statistics.pending_review}
        approved={isStatisticsLoading ? "—" : statistics.approved}
        rejected={isStatisticsLoading ? "—" : statistics.rejected}
        totalApplications={
          isStatisticsLoading ? "—" : statistics.total_applications
        }
      />

      <BusinessApplicationManagementPanel />
    </>
  );
}
