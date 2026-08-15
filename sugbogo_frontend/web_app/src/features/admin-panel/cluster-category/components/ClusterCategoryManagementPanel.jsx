import { useEffect, useState } from "react";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FaLayerGroup } from "react-icons/fa6";
import { Plus } from "lucide-react";
import { FiLayers, FiTag } from "react-icons/fi";

import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import toast from "react-hot-toast";
import { getOrdering } from "@/features/admin-panel/components/data-table/tableUtils";
import Button from "@/shared/components/Button";

import ClusterColumns from "./columns/clusterColumns";
import CategoryColumns from "./columns/categoryColumns";

import useClusters from "../hooks/useClusters";
import useCategories from "../hooks/useCategories";
import useDeleteCluster from "../hooks/useDeleteCluster";
import useDeleteCategory from "../hooks/useDeleteCategory";
import useClusterCategorySummary from "../hooks/useClusterCategorySummary";
import useClusterCategoryTableState from "../hooks/useClusterCategoryTableState";

import CreateClusterModal from "./CreateClusterModal";
import CreateCategoryModal from "./CreateCategoryModal";
import EditClusterModal from "./EditClusterModal";
import EditCategoryModal from "./EditCategoryModal";
import CategoryFilters from "./CategoryFilters";

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
export default function ClusterCategoryTable({
  onEditCluster,
  onEditCategory,
  onCreateCluster,
  onCreateCategory,
  onCreateSuccessReady,
}) {
  // Table state management
  const [currentTab, setCurrentTab] = useState("clusters");

  // Modal state management
  const [isCreateClusterOpen, setIsCreateClusterOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);

  const [isEditClusterOpen, setIsEditClusterOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState(null);

  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  // Mutations
  const { remove: deleteCluster, isDeleting: isDeletingCluster } =
    useDeleteCluster();

  const { remove: deleteCategory, isDeleting: isDeletingCategory } =
    useDeleteCategory();

  const isDeleting =
    deleteType === "cluster" ? isDeletingCluster : isDeletingCategory;

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
    summary,
    isLoading: isLoadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useClusterCategorySummary();

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

  // Refresh Helpers
  async function refreshClusters() {
    await Promise.all([refetchClusters(), refetchSummary()]);
  }

  async function refreshCategories() {
    await Promise.all([refetchCategories(), refetchSummary()]);
  }

  // Derived state for conditional rendering and actions
  const isClusterTab = currentTab === "clusters";
  const columns = isClusterTab
    ? ClusterColumns(handleEditCluster, handleDeleteCluster)
    : CategoryColumns(handleEditCategory, handleDeleteCategory);

  const data = isClusterTab ? clusters : categories;
  const isLoading = isClusterTab ? isLoadingClusters : isLoadingCategories;
  const isFetching = isClusterTab ? isFetchingClusters : isFetchingCategories;
  const totalItems = isClusterTab ? clusterTotalItems : categoryTotalItems;
  const pageCount = isClusterTab ? clusterPageCount : categoryPageCount;

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
  const activeResource = isClusterTab ? "Cluster" : "Category";

  async function handleConfirmDelete() {
    try {
      if (deleteType === "cluster") {
        await deleteCluster(deletingItem.id);

        await refreshClusters();

        toast.success("Cluster deleted successfully.");
      }

      if (deleteType === "category") {
        await deleteCategory(deletingItem.id);

        await refreshCategories();

        toast.success("Category deleted successfully.");
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

  useEffect(() => {
    onCreateSuccessReady?.({
      refreshClusters,
      refreshCategories,
    });
  }, []);

  const resourceLabel = isClusterTab ? "cluster" : "category";
  const resourcePlural = isClusterTab ? "clusters" : "categories";

  function onRetry() {
    if (isClusterTab) {
      refetchClusters();
    } else {
      refetchCategories();
    }

    refetchSummary();
  }

  useApiErrorNotification(clusterError || categoryError || summaryError, {
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
        error={isClusterTab ? clusterError : categoryError}
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
              count: summary.clusterCount,
              icon: FiLayers,
            },
            {
              id: "categories",
              label: "Categories",
              count: summary.categoryCount,
              icon: FiTag,
            },
          ],
          activeTab: currentTab,
          onTabChange: handleTabChange,

          searchPlaceholder: isClusterTab
            ? "Search clusters..."
            : "Search categories...",

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
                  : setIsCreateCategoryOpen(true)
              }
            >
              Add {activeResource}
            </Button>
          ),
          renderFilters: () =>
            !isClusterTab && (
              <CategoryFilters
                clusters={filterClusters}
                selectedCluster={
                  columnFilters.find((filter) => filter.id === "cluster_id")
                    ?.value ?? ""
                }
                onChange={handleClusterFilter}
              />
            ),
        }}
      />

      {/* Modals */}

      <CreateClusterModal
        isOpen={isCreateClusterOpen}
        onClose={() => setIsCreateClusterOpen(false)}
        onSuccess={async () => {
          await refreshClusters();
          toast.success("Cluster created successfully.");
        }}
      />

      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={async () => {
          await refreshCategories();
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
          await refreshClusters();
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
          await refreshCategories();
          toast.success("Category updated successfully.");
        }}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title={`Delete ${deleteType === "cluster" ? "Cluster" : "Category"}?`}
        description={`Are you sure you want to delete "${deletingItem?.name}"? This action cannot be undone.`}
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
