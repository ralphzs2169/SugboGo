import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import MetricCardsSkeleton from "@/features/admin-panel/components/MetricCardsSkeleton";
import ClusterCategoryMetrics from "../cluster-category/components/ClusterCategoryMetrics";
import useClusterStatistics from "../cluster-category/hooks/useClusterStatistics";
import useCategoryStatistics from "../cluster-category/hooks/useCategoryStatistics";
import PageHeader from "../components/PageHeader";
import ClusterCategoryManagementTable from "../cluster-category/components/ClusterCategoryManagementTable";

export default function ClusterCategoryPage() {
  useDocumentTitle("Clusters & Categories | SugboGo Admin");

  const {
    statistics: clusterStatistics,
    isLoading: isClusterStatisticsLoading,
    error: clusterStatisticsError,
    refetch: refetchClusterStatistics,
  } = useClusterStatistics();

  const {
    statistics: categoryStatistics,
    isLoading: isCategoryStatisticsLoading,
    error: categoryStatisticsError,
    refetch: refetchCategoryStatistics,
  } = useCategoryStatistics();

  async function handleStatisticsRefresh() {
    await Promise.all([
      refetchClusterStatistics(),
      refetchCategoryStatistics(),
    ]);
  }

  const isStatisticsLoading =
    isClusterStatisticsLoading || isCategoryStatisticsLoading;

  const statisticsUnavailable =
    Boolean(clusterStatisticsError) || Boolean(categoryStatisticsError);

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
          },
          {
            label: "MSME Management",
          },
          {
            label: "Clusters & Categories",
          },
        ]}
        title="Cluster & Category Management"
      />

      {/* Classification overview */}
      <div className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Classification Overview
        </h2>
      </div>

      {/* Classification metrics */}
      {isStatisticsLoading ? (
        <MetricCardsSkeleton />
      ) : (
        <ClusterCategoryMetrics
          totalClusters={clusterStatistics?.total_clusters}
          clustersCreatedThisWeek={
            clusterStatistics?.clusters_created_this_week
          }
          totalCategories={categoryStatistics?.total_categories}
          categoriesCreatedThisWeek={
            categoryStatistics?.categories_created_this_week
          }
          isError={statisticsUnavailable}
        />
      )}

      <div className="mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Classification Management
        </h2>
      </div>
      {/* Cluster and category management */}
      <ClusterCategoryManagementTable
        onStatisticsChange={handleStatisticsRefresh}
      />
    </>
  );
}
