import { useState } from "react";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FaLayerGroup } from "react-icons/fa6";
import { MessageSquareText, Plus } from "lucide-react";
import { FiLayers, FiTag } from "react-icons/fi";

import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import toast from "react-hot-toast";
import FilterMenu from "../../../admin-panel/components/data-table/FilterMenu";
import Button from "@/shared/components/Button";

import ClusterColumns from "./columns/clusterColumns";
import CategoryColumns from "./columns/categoryColumns";
import DiscoveryShortcutColumns from "./columns/discoveryShortcutColumns";

import useClusters from "../hooks/useClusters";
import useCategories from "../hooks/useCategories";
import useDeleteCluster from "../hooks/useDeleteCluster";
import useDeleteCategory from "../hooks/useDeleteCategory";
import useDeleteDiscoveryShortcut from "../hooks/useDeleteDiscoveryShortcut";
import useDiscoveryShortcuts from "../hooks/useDiscoveryShortcuts";
import useClusterCategoryTableState from "../hooks/useClusterCategoryTableState";

import CreateClusterModal from "./CreateClusterModal";
import CreateCategoryModal from "./CreateCategoryModal";
import EditClusterModal from "./EditClusterModal";
import EditCategoryModal from "./EditCategoryModal";
import CreateDiscoveryShortcutModal from "./CreateDiscoveryShortcutModal";
import EditDiscoveryShortcutModal from "./EditDiscoveryShortcutModal";

import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

/**
 * Combined data table for managing MSME clusters and categories.
 *
 * Handles:
 * - Tab switching between clusters and categories
 * - Server-side search and sorting parameters
 * - Table state management
 * - Dynamic columns and actions
 * - Delete mutations and confirmation flow
 *
 * Data fetching is handled internally through useClusters
 * and useCategories hooks.
 *
 */
export default function ClusterCategoryManagementTable({ onStatisticsChange }) {
  // Table state management
  const [currentTab, setCurrentTab] = useState("clusters");

  // Modal state management
  const [isCreateClusterOpen, setIsCreateClusterOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [isCreateDiscoveryShortcutOpen, setIsCreateDiscoveryShortcutOpen] =
    useState(false);

  const [isEditClusterOpen, setIsEditClusterOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState(null);

  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingDiscoveryShortcut, setEditingDiscoveryShortcut] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  // Mutations
  const { remove: deleteCluster, isDeleting: isDeletingCluster } =
    useDeleteCluster();

  const { remove: deleteCategory, isDeleting: isDeletingCategory } =
    useDeleteCategory();
  const { remove: deleteDiscoveryShortcut, isDeleting: isDeletingShortcut } =
    useDeleteDiscoveryShortcut();

  const isDeleting = deleteType === "cluster"
    ? isDeletingCluster
    : deleteType === "category"
      ? isDeletingCategory
      : isDeletingShortcut;

  // Table state management hook for global filter, sorting, column filters, and pagination.
  const {
    globalFilter,
    setGlobalFilter,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useClusterCategoryTableState(currentTab, setCurrentTab);

  // Data fetching hooks for clusters, categories, and summary

  const {
    clusters,
    totalItems: clusterTotalItems,
    pageCount: clusterPageCount,
    isLoading: isLoadingClusters,
    isFetching: isFetchingClusters,
    error: clusterError,
    refetch: refetchClusters,
  } = useClusters(params, {
    enabled: currentTab === "clusters",
  });

  const {
    categories,
    totalItems: categoryTotalItems,
    pageCount: categoryPageCount,
    isLoading: isLoadingCategories,
    isFetching: isFetchingCategories,
    error: categoryError,
    refetch: refetchCategories,
  } = useCategories(params, {
    enabled: currentTab === "categories",
  });

  const {
    shortcuts,
    totalItems: shortcutTotalItems,
    pageCount: shortcutPageCount,
    isLoading: isLoadingShortcuts,
    isFetching: isFetchingShortcuts,
    error: shortcutError,
    refetch: refetchShortcuts,
  } = useDiscoveryShortcuts(params, {
    enabled: currentTab === "discovery-shortcuts",
  });

  // Derived state for conditional rendering and actions
  const isClusterTab = currentTab === "clusters";
  const isCategoryTab = currentTab === "categories";
  const columns = isClusterTab
    ? ClusterColumns(handleEditCluster, handleDeleteCluster)
    : isCategoryTab
      ? CategoryColumns(handleEditCategory, handleDeleteCategory)
      : DiscoveryShortcutColumns(handleEditDiscoveryShortcut, handleDeleteDiscoveryShortcut);

  let data = shortcuts;

  if (isClusterTab) {
    data = clusters;
  } else if (isCategoryTab) {
    data = categories;
  }
  const isLoading = isClusterTab
    ? isLoadingClusters
    : isCategoryTab
      ? isLoadingCategories
      : isLoadingShortcuts;
  const isFetching = isClusterTab
    ? isFetchingClusters
    : isCategoryTab
      ? isFetchingCategories
      : isFetchingShortcuts;
  const totalItems = isClusterTab
    ? clusterTotalItems
    : isCategoryTab
      ? categoryTotalItems
      : shortcutTotalItems;
  const pageCount = isClusterTab
    ? clusterPageCount
    : isCategoryTab
      ? categoryPageCount
      : shortcutPageCount;
  const activeError = isClusterTab
    ? clusterError
    : isCategoryTab
      ? categoryError
      : shortcutError;

  // Fetch clusters for the category filter dropdown.
  const { clusters: filterClusters } = useClusters(
    { page_size: 100 },
    { enabled: currentTab === "categories" },
  );

  // Event handlers for table actions, modals, and CRUD operations
  function handleDeleteCluster(cluster) {
    setDeletingItem(cluster);
    setDeleteType("cluster");
    setDeleteModalOpen(true);
  }

  function handleDeleteCategory(category) {
    setDeletingItem(category);
    setDeleteType("category");
    setDeleteModalOpen(true);
  }

  function handleEditCluster(cluster) {
    setEditingCluster(cluster);
    setIsEditClusterOpen(true);
  }

  function handleEditCategory(category) {
    setEditingCategory(category);
    setIsEditCategoryOpen(true);
  }

  function handleDeleteDiscoveryShortcut(shortcut) {
    setDeletingItem(shortcut);
    setDeleteType("discovery shortcut");
    setDeleteModalOpen(true);
  }

  function handleEditDiscoveryShortcut(shortcut) {
    setEditingDiscoveryShortcut(shortcut);
  }

  function handleTabChange(tab) {
    setCurrentTab(tab);

    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
    }));

    handleResetFilters();
  }

  function handleClusterFilter(value) {
    const filters = value
      ? [
          {
            id: "cluster_id",
            value,
          },
        ]
      : [];

    setColumnFilters(filters);

    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
    }));
  }
  async function handleConfirmDelete() {
    try {
      if (deleteType === "cluster") {
        await deleteCluster(deletingItem.id);
        await refetchClusters();
        await onStatisticsChange?.();

        toast.success("Cluster deleted successfully.");
      }

      if (deleteType === "category") {
        await deleteCategory(deletingItem.id);
        await refetchCategories();
        await onStatisticsChange?.();

        toast.success("Category deleted successfully.");
      }

      if (deleteType === "discovery shortcut") {
        await deleteDiscoveryShortcut(deletingItem.id);
        await refetchShortcuts();
        toast.success("Discovery shortcut deleted successfully.");
      }

      setDeleteModalOpen(false);
      setDeletingItem(null);
      setDeleteType(null);
    } catch (error) {
      console.error("Failed to delete item:", error);

      toast.error(
        error.response?.data?.message ||
          "The item could not be deleted. Please try again.",
      );
    }
  }

  const resourcePlural = isClusterTab
    ? "clusters"
    : isCategoryTab
      ? "categories"
      : "Discovery shortcuts";

  function onRetry() {
    if (isClusterTab) {
      refetchClusters();
    } else if (isCategoryTab) {
      refetchCategories();
    } else {
      refetchShortcuts();
    }
  }

  useApiErrorNotification(activeError, {
    toastId: "cluster-category-load-error",
    fallbackMessage: "Unable to load the requested data. Please try again.",
  });
  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        error={activeError}
        onRetry={onRetry}
        pagination={pagination}
        state={{
          globalFilter,
          sorting,
          columnFilters,
        }}
        pageCount={pageCount}
        totalItems={totalItems}
        onPaginationChange={setPagination}
        onGlobalFilterChange={setGlobalFilter}
        onSortingChange={setSorting}
        onColumnFiltersChange={setColumnFilters}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        config={{
          tabs: [
            {
              id: "clusters",
              label: "Clusters",
              icon: FiLayers,
            },
            {
              id: "categories",
              label: "Categories",
              icon: FiTag,
            },
            {
              id: "discovery-shortcuts",
              label: "Discovery Shortcuts",
              icon: MessageSquareText,
            },
          ],
          activeTab: currentTab,
          onTabChange: handleTabChange,

          searchPlaceholder: isClusterTab
            ? "Search clusters..."
            : isCategoryTab
              ? "Search categories..."
              : "Search Discovery shortcuts...",

          footerMetaText: `Showing ${data.length} ${resourcePlural}`,

          emptyState: {
            title: `No ${resourcePlural} yet`,
            description:
              "New " + resourcePlural + " will appear here once created.",
            icon: <FaLayerGroup className="h-10 w-10 text-text-secondary" />,
          },
          noResultsState: {
            title: `No ${resourcePlural} found`,
          },
          errorState: {
            title: `Unable to load ${resourcePlural}`,
            message: `The requested ${resourcePlural} could not be loaded.`,
          },
        }}
        slots={{
          renderHeaderActions: () => (
            <Button
              icon={Plus}
              onClick={() =>
                isClusterTab
                  ? setIsCreateClusterOpen(true)
                  : isCategoryTab
                    ? setIsCreateCategoryOpen(true)
                    : setIsCreateDiscoveryShortcutOpen(true)
              }
            >
              Add{" "}
              {isClusterTab
                ? "Cluster"
                : isCategoryTab
                  ? "Category"
                  : "Discovery Shortcut"}
            </Button>
          ),
          renderFilters: () =>
            isCategoryTab && (
              <FilterMenu
                filters={[
                  {
                    key: "cluster_id",
                    label: "Cluster",
                    icon: FaLayerGroup,
                    options: filterClusters.map((cluster) => ({
                      value: cluster.id,
                      label: cluster.name,
                    })),
                    value:
                      columnFilters.find((filter) => filter.id === "cluster_id")
                        ?.value ?? "",
                    onChange: handleClusterFilter,
                  },
                ]}
              />
            ),
        }}
      />

      {/* Modals */}

      <CreateClusterModal
        isOpen={isCreateClusterOpen}
        onClose={() => setIsCreateClusterOpen(false)}
        onSuccess={async () => {
          await refetchClusters();
          await onStatisticsChange?.();

          toast.success("Cluster created successfully.");
        }}
      />

      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={async () => {
          await refetchCategories();
          await onStatisticsChange?.();

          toast.success("Category created successfully.");
        }}
      />

      <EditClusterModal
        isOpen={isEditClusterOpen}
        cluster={editingCluster}
        onClose={() => {
          setIsEditClusterOpen(false);
          setEditingCluster(null);
        }}
        onSuccess={async () => {
          await refetchClusters();
          await onStatisticsChange?.();

          toast.success("Cluster updated successfully.");
        }}
      />

      <EditCategoryModal
        isOpen={isEditCategoryOpen}
        category={editingCategory}
        onClose={() => {
          setIsEditCategoryOpen(false);
          setEditingCategory(null);
        }}
        onSuccess={async () => {
          await refetchCategories();
          await onStatisticsChange?.();

          toast.success("Category updated successfully.");
        }}
      />

      <CreateDiscoveryShortcutModal
        isOpen={isCreateDiscoveryShortcutOpen}
        shortcuts={shortcuts}
        onClose={() => setIsCreateDiscoveryShortcutOpen(false)}
        onSuccess={async () => {
          await refetchShortcuts();
          toast.success("Discovery shortcut created successfully.");
        }}
      />

      <EditDiscoveryShortcutModal
        isOpen={Boolean(editingDiscoveryShortcut)}
        shortcut={editingDiscoveryShortcut}
        onClose={() => setEditingDiscoveryShortcut(null)}
        onSuccess={async () => {
          await refetchShortcuts();
          toast.success("Discovery shortcut updated successfully.");
        }}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title={`Delete ${
          deleteType === "discovery shortcut"
            ? "Discovery Shortcut"
            : deleteType === "cluster"
              ? "Cluster"
              : "Category"
        }?`}
        description={`Are you sure you want to delete "${deletingItem?.title ?? deletingItem?.name}"? This action cannot be undone.`}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingItem(null);
          setDeleteType(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
      />
    </>
  );
}
