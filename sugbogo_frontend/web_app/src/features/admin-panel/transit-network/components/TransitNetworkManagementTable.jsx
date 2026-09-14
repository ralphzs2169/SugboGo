import { useState } from "react";
import {
  ArrowRightLeft,
  BusFront,
  MapPin,
  Plus,
  Sparkles,
  Tags,
} from "lucide-react";

import Button from "@/shared/components/Button";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import getJeepneyRouteColumns from "../columns/jeepneyRouteColumns";
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
  TransitTransferDetailModal,
  TransitTransferFormModal,
  TransitTransferReviewModal,
} from "./TransitTransferModals";
import TransferMapReviewModal from "./transfer-review/TransferMapReviewModal";
import TransferSuggestionScanButton from "./transfer-review/TransferSuggestionScanButton";
import TransitPointWorkspace from "./transit-point-workspace/TransitPointWorkspace";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending review" },
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
    emptyDescription:
      "Add a directed connection manually or scan the network for suggestions.",
    icon: ArrowRightLeft,
  },
};

/**
 * Coordinates the tabbed transit management experience for all network resources.
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
  const [mapReviewTransfer, setMapReviewTransfer] = useState(null);
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
      : currentTab === "transfers"
        ? getTransitTransferColumns({
            onView: (transfer) => setDetailId(transfer.id),
            onViewMap: setMapReviewTransfer,
            onEdit: openEditForm,
            onConfirm: (transfer) => openReview(transfer, "confirm"),
            onIgnore: (transfer) => openReview(transfer, "ignore"),
          })
        : [];

  useApiErrorNotification(activeQuery.error, {
    toastId: `transit-${currentTab}-load-error`,
    fallbackMessage: `Unable to load ${activeConfig.label.toLowerCase()}. Please try again.`,
  });

  const transferEmptyState =
    currentTab === "transfers" && statusFilter === "pending"
      ? {
          title: "No suggestions need review",
          description:
            "Scan the transit network to look for possible transfer connections.",
        }
      : {
          title: activeConfig.emptyTitle,
          description: activeConfig.emptyDescription,
        };

  function editTransferFromDetail(transfer) {
    setDetailId(null);
    openEditForm(transfer);
  }

  function reviewTransferFromDetail(transfer, action) {
    setDetailId(null);
    openReview(transfer, action);
  }

  function mapTransferFromDetail(transfer) {
    setDetailId(null);
    setMapReviewTransfer(transfer);
  }

  return (
    <>
      {/* Transit resource workspace */}
      {currentTab === "transit-points" ? (
        <TransitPointWorkspace
          tabs={Object.entries(TAB_CONFIG).map(([id, config]) => ({
            id,
            label: config.label,
            icon: config.icon,
          }))}
          activeTab={currentTab}
          onTabChange={handleTabChange}
          query={pointsQuery}
          search={globalFilter}
          isSearching={isSearching}
          pagination={pagination}
          onSearchChange={setGlobalFilter}
          onPageChange={setPagination}
        />
      ) : (
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
              title: transferEmptyState.title,
              description: transferEmptyState.description,
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
                <div className="flex flex-wrap items-center gap-2">
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
                  <Button
                    variant={
                      statusFilter === "pending" ? "primary" : "secondary"
                    }
                    size="sm"
                    icon={Sparkles}
                    aria-pressed={statusFilter === "pending"}
                    onClick={() =>
                      setStatusFilter(
                        statusFilter === "pending" ? "" : "pending",
                      )
                    }
                  >
                    Pending Suggestions
                  </Button>
                </div>
              ) : null,
            renderHeaderActions: () =>
              currentTab === "transfers" ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <TransferSuggestionScanButton />
                  <Button icon={Plus} onClick={openCreateForm}>
                    Add Transfer
                  </Button>
                </div>
              ) : (
                <Button icon={Plus} onClick={openCreateForm}>
                  Add {activeConfig.singular}
                </Button>
              ),
          }}
        />
      )}

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
        onEdit={editTransferFromDetail}
        onConfirm={(transfer) => reviewTransferFromDetail(transfer, "confirm")}
        onIgnore={(transfer) => reviewTransferFromDetail(transfer, "ignore")}
        onViewMap={mapTransferFromDetail}
      />
      <TransitTransferReviewModal
        transfer={reviewTransfer}
        action={reviewAction}
        onClose={closeReview}
      />
      <TransferMapReviewModal
        transfer={mapReviewTransfer}
        onClose={() => setMapReviewTransfer(null)}
      />
    </>
  );
}
