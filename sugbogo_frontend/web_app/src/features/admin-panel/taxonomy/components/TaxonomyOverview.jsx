import { Building2, Layers, Tag, Tags } from "lucide-react";

import { formatCount } from "../../analytics/utils/presentation";
import useBusinessOverview from "../../businesses/hooks/useBusinessOverview";
import useCategoryStatistics from "../../cluster-category/hooks/useCategoryStatistics";
import useClusterStatistics from "../../cluster-category/hooks/useClusterStatistics";
import { LoadGroupFeedback } from "../../components/PageLoadFeedback";
import MetricCard from "../../components/MetricCard";
import DashboardSkeleton from "../../dashboard/components/DashboardSkeleton";
import useSpecialtyTagStatistics from "../../specialty-tags/hooks/useSpecialtyTagStatistics";

function TaxonomyMetric({ title, description, icon, query, value }) {
  if (query.isLoading && query.data == null) {
    return <DashboardSkeleton label={title} variant="activity" />;
  }

  return (
    <MetricCard
      wrapTitle
      title={title}
      icon={icon}
      value={formatCount(value)}
      footerValue={description}
    />
  );
}

/** Keep four inventory KPIs fixed and independent of taxonomy table state. */
export default function TaxonomyOverview() {
  const clusters = useClusterStatistics();
  const categories = useCategoryStatistics();
  const specialties = useSpecialtyTagStatistics();
  const businesses = useBusinessOverview();

  return (
    <div className="space-y-3">
      <LoadGroupFeedback
        section="overview"
        label="Taxonomy counts"
        retryLabel="Retry taxonomy counts"
        queries={[clusters, categories, specialties, businesses]}
      />
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
    </div>
  );
}
