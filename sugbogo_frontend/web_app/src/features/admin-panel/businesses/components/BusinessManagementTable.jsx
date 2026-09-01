import { useNavigate } from "react-router-dom";
import { Building2, Map, Tag, Layers, Tags, Download } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import FilterMenu from "../../../admin-panel/components/data-table/FilterMenu";
import BusinessColumns from "../columns/businessColumns";
import useBusinesses from "../hooks/useBusinesses";
import useBusinessMap from "../hooks/useBusinessMap";
import useBusinessTableState from "../hooks/useBusinessTableState";
import BusinessManagementMap from "./business-location/BusinessManagementMap";
import useClusters from "../../cluster-category/hooks/useClusters";
import useCategories from "../../cluster-category/hooks/useCategories";
import useSpecialtyTags from "../../specialty-tags/hooks/useSpecialtyTags";
import Button from "@/shared/components/Button";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export default function BusinessManagementTable() {
  const navigate = useNavigate();

  const {
    currentTab,
    setCurrentTab,
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
    isSearching,
    // new filters — see useBusinessTableState update below
    clusterFilter,
    setClusterFilter,
    categoryFilter,
    setCategoryFilter,
    specialtyTagFilter,
    setSpecialtyTagFilter,
  } = useBusinessTableState();

  const {
    businesses,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useBusinesses(params);

  const {
    businesses: mapBusinesses,
    isLoading: isMapLoading,
    isFetching: isMapFetching,
    error: mapError,
    refetch: refetchMap,
  } = useBusinessMap({
    enabled: currentTab === "map",
    search: params.search,
    status: statusFilter,
    cluster: clusterFilter,
    category: categoryFilter,
    specialtyTag: specialtyTagFilter,
  });

  // Filter option sources — fetched once, not paginated/searched.
  const { clusters } = useClusters({ page_size: 100 });
  const { categories } = useCategories({ page_size: 100 });
  const { specialtyTags } = useSpecialtyTags({ page_size: 100 });

  function handleViewBusiness(business) {
    navigate(`/admin-panel/businesses/${business.id}`);
  }

  const columns = BusinessColumns(handleViewBusiness);

  function renderFilters() {
    return (
      <FilterMenu
        filters={[
          {
            key: "status",
            label: "Status",
            icon: Tag,
            options: STATUS_OPTIONS,
            value: statusFilter,
            onChange: setStatusFilter,
          },
          {
            key: "cluster",
            label: "Cluster",
            icon: Layers,
            options: clusters.map((cluster) => ({
              value: String(cluster.id),
              label: cluster.name,
            })),
            value: clusterFilter,
            onChange: setClusterFilter,
          },
          {
            key: "category",
            label: "Category",
            icon: Tag,
            options: categories.map((category) => ({
              value: String(category.id),
              label: category.name,
            })),
            value: categoryFilter,
            onChange: setCategoryFilter,
          },
          {
            key: "specialty_tag",
            label: "Specialty Tag",
            icon: Tags,
            options: specialtyTags.map((tag) => ({
              value: String(tag.id),
              label: tag.name,
            })),
            value: specialtyTagFilter,
            onChange: setSpecialtyTagFilter,
          },
        ]}
      />
    );
  }

  useApiErrorNotification(error, {
    toastId: "businesses-load-error",
    fallbackMessage: "Unable to load businesses. Please try again.",
  });

  useApiErrorNotification(mapError, {
    toastId: "business-map-load-error",
    fallbackMessage: "Unable to load business locations. Please try again.",
  });

  return (
    <DataTable
      data={businesses}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={refetch}
      pagination={pagination}
      state={{ globalFilter, sorting }}
      pageCount={pageCount}
      totalItems={totalItems}
      onPaginationChange={setPagination}
      onGlobalFilterChange={setGlobalFilter}
      onSortingChange={setSorting}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      isSearching={isSearching}
      config={{
        tabs: [
          { id: "businesses", label: "Businesses", icon: Building2 },
          { id: "map", label: "Map View", icon: Map },
        ],
        activeTab: currentTab,
        onTabChange: setCurrentTab,
        searchPlaceholder: "Search businesses...",
        emptyState: {
          title: "No businesses yet",
          description:
            "Approved merchant businesses will appear here once they are created.",
          icon: <Building2 className="h-10 w-10 text-text-secondary" />,
        },
        noResultsState: { title: "No businesses found" },
        errorState: {
          title: "Unable to load businesses",
          message: "The requested businesses could not be loaded.",
        },
      }}
      slots={{
        renderFilters,
        renderHeaderActions: () => (
          <Button
            variant="secondary"
            size="md"
            icon={Download}
            onClick={() => {}}
          >
            Export
          </Button>
        ),
        renderContent:
          currentTab === "map"
            ? () => (
                <div className="overflow-hidden rounded-lg border border-stroke bg-background">
                  <BusinessManagementMap
                    businesses={mapBusinesses}
                    isLoading={isMapLoading}
                    isFetching={isMapFetching}
                    error={mapError}
                    onRetry={refetchMap}
                    hasActiveFilters={hasActiveFilters}
                    onResetFilters={handleResetFilters}
                    onViewBusiness={handleViewBusiness}
                    className="h-[600px] rounded-none border-0"
                  />
                </div>
              )
            : undefined,
      }}
    />
  );
}
