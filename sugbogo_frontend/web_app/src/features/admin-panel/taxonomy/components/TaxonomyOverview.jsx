import { Building2, Layers, Tag, Tags } from "lucide-react";

import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { formatCount } from "../../analytics/utils/presentation";
import useBusinessOverview from "../../businesses/hooks/useBusinessOverview";
import useCategoryStatistics from "../../cluster-category/hooks/useCategoryStatistics";
import useClusterStatistics from "../../cluster-category/hooks/useClusterStatistics";
import MetricCard from "../../components/MetricCard";
import DashboardSkeleton from "../../dashboard/components/DashboardSkeleton";
import useSpecialtyTagStatistics from "../../specialty-tags/hooks/useSpecialtyTagStatistics";

/** Recover one inventory request without hiding successfully loaded sibling cards. */
function TaxonomyMetric({ title, description, icon, query, value }) {
  const hasData = query.data != null;

  useApiErrorNotification(query.error, {
    toastId: `taxonomy-overview-${title}`,
    fallbackMessage: `Unable to load ${title.toLowerCase()}. Please try again.`,
  });

  return (
    <div className="min-w-0" aria-busy={query.isFetching}>
      {query.isLoading && !hasData ? (
        <DashboardSkeleton label={title} variant="activity" />
      ) : (
        <MetricCard
          wrapTitle
          title={title}
          icon={icon}
          value={formatCount(value)}
          footerValue={description}
        />
      )}
      {query.error && (
        <DataErrorState
          compact
          framed
          retainedData={hasData}
          refreshLabel={title}
          title={`Unable to load ${title.toLowerCase()}`}
          message="This inventory count is currently unavailable."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
          retryLabel={`Retry ${title.toLowerCase()}`}
        />
      )}
    </div>
  );
}

/** Keep four inventory KPIs fixed and independent of taxonomy table state. */
export default function TaxonomyOverview() {
  const clusters = useClusterStatistics();
  const categories = useCategoryStatistics();
  const specialties = useSpecialtyTagStatistics();
  const businesses = useBusinessOverview();

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <TaxonomyMetric
        title="Total Clusters"
        description="Business groupings"
        icon={Layers}
        query={clusters}
        value={clusters.data?.total_clusters}
      />
      <TaxonomyMetric
        title="Total Categories"
        description="Business classifications"
        icon={Tag}
        query={categories}
        value={categories.data?.total_categories}
      />
      <TaxonomyMetric
        title="Specialty Tags"
        description="Available specialty labels"
        icon={Tags}
        query={specialties}
        value={specialties.data?.total_tags}
      />
      <TaxonomyMetric
        title="Classified Businesses"
        description="Total retained businesses"
        icon={Building2}
        query={businesses}
        value={businesses.data?.business_status?.total}
      />
    </div>
  );
}
