import { useNavigate } from "react-router-dom";
import { Building2, Map, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterPill from "../../components/FilterPill";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import BusinessColumns from "../columns/businessColumns";
import useBusinesses from "../hooks/useBusinesses";
import useBusinessMap from "../hooks/useBusinessMap";
import useBusinessTableState from "../hooks/useBusinessTableState";
import BusinessManagementMap from "./business-location/BusinessManagementMap";

const STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active",
  },
  {
    value: "suspended",
    label: "Suspended",
  },
];

/**
 * Provides tabbed management views for permanent merchant businesses.
 *
 * The Businesses tab provides the paginated management table, while the
 * Map tab provides a geographic view of businesses. Map data is loaded
 * only when the Map tab is active.
 */
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
  });

  function handleViewBusiness(business) {
    navigate(`/admin-panel/businesses/${business.id}`);
  }

  const columns = BusinessColumns(handleViewBusiness);

  function renderFilters() {
    return (
      <FilterPill
        icon={Tag}
        placeholder="All statuses"
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={setStatusFilter}
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
      state={{
        globalFilter,
        sorting,
      }}
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
          {
            id: "businesses",
            label: "Businesses",
            icon: Building2,
          },
          {
            id: "map",
            label: "Map View",
            icon: Map,
          },
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

        noResultsState: {
          title: "No businesses found",
        },

        errorState: {
          title: "Unable to load businesses",
          message: "The requested businesses could not be loaded.",
        },
      }}
      slots={{
        renderFilters,

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
