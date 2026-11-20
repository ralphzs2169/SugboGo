import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Map, Tag, Layers, Tags } from "lucide-react";

import { LoadGroupFeedback } from "../../components/PageLoadFeedback";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "../../../admin-panel/components/data-table/FilterMenu";
import BusinessStatusDialog from "./BusinessStatusDialog";
import BusinessColumns from "../columns/businessColumns";
import useBusinesses from "../hooks/useBusinesses";
import useBusinessMap from "../hooks/useBusinessMap";
import useBusinessTableState from "../hooks/useBusinessTableState";
import BusinessManagementMap from "./business-location/BusinessManagementMap";
import { useQuery } from "@tanstack/react-query";
import { taxonomyReferenceOptions } from "../../taxonomy/queries/taxonomyQueries";
import TaxonomyOptionFeedback from "../../taxonomy/components/TaxonomyOptionFeedback";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export default function BusinessManagementTable() {
  const navigate = useNavigate();
  const [statusAction, setStatusAction] = useState(null);

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
    hasData,
    error,
    refetch,
  } = useBusinesses(params, { enabled: currentTab === "businesses" });

  const map = useBusinessMap({
    enabled: currentTab === "map",
    search: params.search,
    status: statusFilter,
    cluster: clusterFilter,
    category: categoryFilter,
    specialtyTag: specialtyTagFilter,
  });

  // Complete option sources stay independent of the directory's filters and page.
  const clusterOptionsQuery = useQuery(taxonomyReferenceOptions("clusters"));
  const categoryOptionsQuery = useQuery(taxonomyReferenceOptions("categories"));
  const specialtyOptionsQuery = useQuery(taxonomyReferenceOptions("specialty-tags"));
  const clusters = clusterOptionsQuery.data ?? [];
  const categories = categoryOptionsQuery.data ?? [];
  const specialtyTags = specialtyOptionsQuery.data ?? [];

  function handleViewBusiness(business) {
    navigate(`/admin-panel/businesses/${business.id}`);
  }

  const columns = BusinessColumns(handleViewBusiness, (business, operation) => {
    setStatusAction({ business, operation });
  });

  function renderFilterFeedback() {
    return (
      <TaxonomyOptionFeedback
        queries={[clusterOptionsQuery, categoryOptionsQuery, specialtyOptionsQuery]}
      />
    );
  }

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
            disabled: clusterOptionsQuery.isPending || Boolean(clusterOptionsQuery.error),
            disabledMessage: clusterOptionsQuery.error
              ? "Cluster options unavailable."
              : "Loading cluster options…",
            emptyMessage: "No cluster options available.",
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
            disabled: categoryOptionsQuery.isPending || Boolean(categoryOptionsQuery.error),
            disabledMessage: categoryOptionsQuery.error
              ? "Category options unavailable."
              : "Loading category options…",
            emptyMessage: "No category options available.",
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
            disabled: specialtyOptionsQuery.isPending || Boolean(specialtyOptionsQuery.error),
            disabledMessage: specialtyOptionsQuery.error
              ? "Specialty Tag options unavailable."
              : "Loading specialty tag options…",
            emptyMessage: "No specialty tag options available.",
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



  return (
    <>
      <DataTable
        data={businesses}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        error={currentTab === "businesses" ? error : null}
        hasData={hasData}
        loadSection="directory"
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
          managementControls: true,
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
          renderFilterFeedback,
          renderContent:
            currentTab === "map"
              ? () => (
                  <div className="space-y-3">
                    <LoadGroupFeedback
                      section="directory"
                      label="Business locations"
                      retryLabel="Retry map"
                      queries={[map]}
                    />
                    <div className="overflow-hidden rounded-lg border border-stroke bg-background">
                      <BusinessManagementMap
                        businesses={map.data ?? []}
                        isLoading={map.isLoading}
                        isFetching={map.isFetching}
                        unavailable={Boolean(map.error && map.data == null)}
                        hasActiveFilters={hasActiveFilters}
                        onResetFilters={handleResetFilters}
                        onViewBusiness={handleViewBusiness}
                        className="h-[680px] rounded-none border-0"
                      />
                    </div>
                  </div>
                )
              : undefined,
        }}
      />
      {statusAction && (
        <BusinessStatusDialog
          key={`${statusAction.business.id}-${statusAction.operation}`}
          business={statusAction.business}
          operation={statusAction.operation}
          onClose={() => setStatusAction(null)}
        />
      )}
    </>
  );
}
