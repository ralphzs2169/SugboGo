import { useState } from "react";
import { ArrowRightLeft, BusFront, MapPin, Plus, Tags } from "lucide-react";

import Button from "@/shared/components/Button";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import getJeepneyRouteColumns from "../columns/jeepneyRouteColumns";
import getTransitPointColumns from "../columns/transitPointColumns";
import getTransitTransferColumns from "../columns/transitTransferColumns";
import useTransitTableState from "../hooks/useTransitTableState";
import {
  useJeepneyRoutes,
  useTransitPoints,
  useTransitTransfers,
} from "../hooks/useTransitQueries";
import {
  JeepneyRouteDetailModal,
  JeepneyRouteFormModal,
} from "./JeepneyRouteModals";
import {
  TransitPointDetailModal,
  TransitPointFormModal,
} from "./TransitPointModals";
import {
  TransitTransferDetailModal,
  TransitTransferFormModal,
  TransitTransferReviewModal,
} from "./TransitTransferModals";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ignored", label: "Ignored" },
];

const TAB_CONFIG = {
  routes: {
    label: "Routes",
    singular: "Route",
    searchPlaceholder: "Search route codes...",
    emptyTitle: "No jeepney routes yet",
    emptyDescription: "Add a route code to begin organizing directional variants.",
    icon: BusFront,
  },
  "transit-points": {
    label: "Transit Points",
    singular: "Transit Point",
    searchPlaceholder: "Search Transit Points...",
    emptyTitle: "No Transit Points yet",
    emptyDescription: "Add managed stops and transfer locations to the network.",
    icon: MapPin,
  },
  transfers: {
    label: "Transfers",
    singular: "Transfer",
    emptyTitle: "No transit transfers yet",
    emptyDescription: "Add a directed connection between two route variants.",
    icon: ArrowRightLeft,
  },
};

/**
 * Coordinates the tabbed DataTable experience for all transit network resources.
 *
 * React Query owns each tab's server state while this component manages only
 * table controls, dialogs, and selected records.
 */
export default function TransitNetworkManagementTable() {
  const [formMode, setFormMode] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [reviewTransfer, setReviewTransfer] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const {
    currentTab,
    globalFilter,
    setGlobalFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    isSearching,
    statusFilter,
    setStatusFilter,
    routeParams,
    pointParams,
    transferParams,
    hasActiveFilters,
    handleTabChange,
    handleResetFilters,
  } = useTransitTableState();
  const routesQuery = useJeepneyRoutes(routeParams, {
    enabled: currentTab === "routes",
  });
  const pointsQuery = useTransitPoints(pointParams, {
    enabled: currentTab === "transit-points",
  });
  const transfersQuery = useTransitTransfers(transferParams, {
    enabled: currentTab === "transfers",
  });

  const activeQuery =
    currentTab === "routes"
      ? routesQuery
      : currentTab === "transit-points"
        ? pointsQuery
        : transfersQuery;
  const activeConfig = TAB_CONFIG[currentTab];

  function openCreateForm() {
    setEditingRecord(null);
    setFormMode("create");
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setEditingRecord(null);
  }

  function openReview(transfer, action) {
    setReviewTransfer(transfer);
    setReviewAction(action);
  }

  function closeReview() {
    setReviewTransfer(null);
    setReviewAction(null);
  }

  const columns =
    currentTab === "routes"
      ? getJeepneyRouteColumns(
          (route) => setDetailId(route.id),
          openEditForm,
        )
      : currentTab === "transit-points"
        ? getTransitPointColumns(
            (point) => setDetailId(point.id),
            openEditForm,
          )
        : getTransitTransferColumns({
            onView: (transfer) => setDetailId(transfer.id),
            onEdit: openEditForm,
            onConfirm: (transfer) => openReview(transfer, "confirm"),
            onIgnore: (transfer) => openReview(transfer, "ignore"),
          });

  useApiErrorNotification(activeQuery.error, {
    toastId: `transit-${currentTab}-load-error`,
    fallbackMessage: `Unable to load ${activeConfig.label.toLowerCase()}. Please try again.`,
  });

  return (
    <>
      {/* Transit resource table */}
      <DataTable
        data={activeQuery.items}
        columns={columns}
        isLoading={activeQuery.isLoading}
        isFetching={activeQuery.isFetching}
        isSearching={currentTab === "transfers" ? false : isSearching}
        error={activeQuery.error}
        onRetry={activeQuery.refetch}
        pagination={pagination}
        state={{ globalFilter, sorting }}
        pageCount={activeQuery.pageCount}
        totalItems={activeQuery.totalItems}
        onPaginationChange={setPagination}
        onGlobalFilterChange={setGlobalFilter}
        onSortingChange={setSorting}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        config={{
          tabs: Object.entries(TAB_CONFIG).map(([id, config]) => ({
            id,
            label: config.label,
            icon: config.icon,
          })),
          activeTab: currentTab,
          onTabChange: handleTabChange,
          searchPlaceholder: activeConfig.searchPlaceholder,
          showSearch: currentTab !== "transfers",
          emptyState: {
            title: activeConfig.emptyTitle,
            description: activeConfig.emptyDescription,
            icon: (
              <activeConfig.icon className="h-10 w-10 text-text-secondary" />
            ),
          },
          noResultsState: {
            title: `No ${activeConfig.label.toLowerCase()} found`,
          },
          errorState: {
            title: `Unable to load ${activeConfig.label.toLowerCase()}`,
            message: `The requested ${activeConfig.label.toLowerCase()} could not be loaded.`,
          },
        }}
        slots={{
          renderFilters: () =>
            currentTab === "transfers" ? (
              <FilterMenu
                filters={[
                  {
                    key: "status",
                    label: "Status",
                    icon: Tags,
                    options: STATUS_OPTIONS,
                    value: statusFilter,
                    onChange: setStatusFilter,
                  },
                ]}
              />
            ) : null,
          renderHeaderActions: () => (
            <Button icon={Plus} onClick={openCreateForm}>
              Add {activeConfig.singular}
            </Button>
          ),
        }}
      />

      {/* Route dialogs */}
      {formMode && currentTab === "routes" && (
        <JeepneyRouteFormModal
          key={`${formMode}-${editingRecord?.id ?? "new"}`}
          isOpen
          route={formMode === "edit" ? editingRecord : null}
          onClose={closeForm}
        />
      )}
      <JeepneyRouteDetailModal
        routeId={currentTab === "routes" ? detailId : null}
        onClose={() => setDetailId(null)}
      />

      {/* Transit Point dialogs */}
      {formMode && currentTab === "transit-points" && (
        <TransitPointFormModal
          key={`${formMode}-${editingRecord?.id ?? "new"}`}
          isOpen
          transitPoint={formMode === "edit" ? editingRecord : null}
          onClose={closeForm}
        />
      )}
      <TransitPointDetailModal
        transitPointId={currentTab === "transit-points" ? detailId : null}
        onClose={() => setDetailId(null)}
      />

      {/* Transfer dialogs */}
      {formMode && currentTab === "transfers" && (
        <TransitTransferFormModal
          key={`${formMode}-${editingRecord?.id ?? "new"}`}
          isOpen
          transfer={formMode === "edit" ? editingRecord : null}
          onClose={closeForm}
        />
      )}
      <TransitTransferDetailModal
        transferId={currentTab === "transfers" ? detailId : null}
        onClose={() => setDetailId(null)}
      />
      <TransitTransferReviewModal
        transfer={reviewTransfer}
        action={reviewAction}
        onClose={closeReview}
      />
    </>
  );
}
