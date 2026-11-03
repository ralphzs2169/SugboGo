import { ClipboardList, List } from "lucide-react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import BusinessApplicationManagementTable from "../business-applications/components/BusinessApplicationManagementTable";
import useBusinessApplicationStatistics from "../business-applications/hooks/useBusinessApplicationStatistics";
import useBusinessApplicationTableState from "../business-applications/hooks/useBusinessApplicationTableState";
import BusinessApplicationMetrics from "../business-applications/components/BusinessApplicationMetrics";
import ApplicationReviewSlaInfo from "../business-applications/components/ApplicationReviewSlaInfo";
import MetricCardsSkeleton from "@/features/admin-panel/components/MetricCardsSkeleton";
import ApplicationReviewSlaInfoSkeleton from "../business-applications/components/skeleton/ApplicationReviewSlaInfoSkeleton";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

export default function BusinessApplicationsPage() {
  useDocumentTitle("Business Applications | SugboGo Admin");

  const tableState = useBusinessApplicationTableState();

  const {
    statistics,
    isLoading: isStatisticsLoading,
    error: statisticsError,
    refetch: refetchStatistics,
  } = useBusinessApplicationStatistics();

  const statisticsUnavailable = Boolean(statisticsError);

  useApiErrorNotification(statisticsError, {
    toastId: "business-application-statistics-error",
    fallbackMessage: "Unable to load application statistics. Please try again.",
  });

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
            label: "Merchant Applications",
          },
        ]}
        title="Merchant Application Management"
      />

      {/* Application overview */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
            <ClipboardList aria-hidden="true" className="h-4 w-4 shrink-0" />
            Merchant Application Overview
          </h2>
          <p className="-mt-2 mb-3 text-xs text-text-secondary">
            Current review queue and SLA status · PHT
          </p>
        </div>

        {!isStatisticsLoading && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span>
              {statisticsUnavailable ? "—" : statistics.total_applications}{" "}
              total
            </span>

            <span className="text-stroke">·</span>

            <span className="text-emerald-500">
              {statisticsUnavailable ? "—" : statistics.approved} approved
            </span>

            <span className="text-stroke">·</span>

            <span className="text-rose-500">
              {statisticsUnavailable ? "—" : statistics.rejected} rejected
            </span>

            <span className="text-stroke">·</span>

            <span>
              {statisticsUnavailable ? "—" : statistics.pending_review} pending
            </span>
          </div>
        )}
      </div>

      {/* Application metrics */}
      {isStatisticsLoading ? (
        <MetricCardsSkeleton count={4} />
      ) : statisticsUnavailable ? (
        <div className="mb-6">
          <DataErrorState
            title="Unable to load application statistics"
            message="Application metrics are currently unavailable. Please try again."
            onRetry={refetchStatistics}
          />
        </div>
      ) : (
        <BusinessApplicationMetrics
          pendingReview={statistics.pending_review}
          approachingSla={statistics.approaching_sla}
          overdue={statistics.overdue}
          oldestPendingBusinessDays={statistics.oldest_pending_business_days}
          onFilterQueue={tableState.setReviewQueueFilter}
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
          isError={statisticsUnavailable}
        />
      )}

      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
        <List aria-hidden="true" className="h-4 w-4 shrink-0" />
        All Merchant Applications
      </h2>
      {/* Application management */}
      <BusinessApplicationManagementTable tableState={tableState} />
    </>
  );
}
