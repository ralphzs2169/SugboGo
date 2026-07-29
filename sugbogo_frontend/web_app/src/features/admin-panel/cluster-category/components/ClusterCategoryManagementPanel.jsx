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

import CreateClusterModal from "./CreateClusterModal";
import CreateCategoryModal from "./CreateCategoryModal";
import EditClusterModal from "./EditClusterModal";
import EditCategoryModal from "./EditCategoryModal";

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
 * @component
 *
 * @param {Object} props
 * @param {Function} props.onEditCluster - Opens cluster edit modal.
 * @param {Function} props.onEditCategory - Opens category edit modal.
 * @param {Function} props.onCreateCluster - Opens create cluster modal.
 * @param {Function} props.onCreateCategory - Opens create category modal.
 *
 * @returns {JSX.Element}
 */
export default function ClusterCategoryTable({
  onEditCluster,
  onEditCategory,
  onCreateCluster,
  onCreateCategory,
  onCreateSuccessReady,
}) {
  const [currentTab, setCurrentTab] = useState("clusters");

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isCreateClusterOpen, setIsCreateClusterOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);

  const [isEditClusterOpen, setIsEditClusterOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState(null);

  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  const { remove: deleteCluster } = useDeleteCluster();
  const { remove: deleteCategory } = useDeleteCategory();

  const params = {
    search: globalFilter || undefined,
    ordering: getOrdering(sorting),
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };

  const {
    clusters,
    totalItems: clusterTotalItems,
    pageCount: clusterPageCount,
    isLoading: isLoadingClusters,
    refetch: refetchClusters,
  } = useClusters(params);

  const {
    categories,
    totalItems: categoryTotalItems,
    pageCount: categoryPageCount,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useCategories(params);

  const refreshClusters = async () => {
    await refetchClusters();
  };

  const refreshCategories = async () => {
    await refetchCategories();
  };

  const isClusterTab = currentTab === "clusters";

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
  async function handleConfirmDelete() {
    let result;

    if (deleteType === "cluster") {
      result = await deleteCluster(deletingItem.id);

      if (result.success) {
        await refetchClusters();

        toast.success("Cluster deleted successfully.");
      }
    }

    if (deleteType === "category") {
      result = await deleteCategory(deletingItem.id);

      if (result.success) {
        await refetchCategories();

        toast.success("Category deleted successfully.");
      }
    }

    if (!result?.success) {
      return;
    }

    setDeleteModalOpen(false);
    setDeletingItem(null);
    setDeleteType(null);
  }

  const columns = isClusterTab
    ? ClusterColumns(handleEditCluster, handleDeleteCluster)
    : CategoryColumns(handleEditCategory, handleDeleteCategory);

  const data = isClusterTab ? clusters : categories;

  const isLoading = isClusterTab ? isLoadingClusters : isLoadingCategories;

  const totalItems = isClusterTab ? clusterTotalItems : categoryTotalItems;

  const pageCount = isClusterTab ? clusterPageCount : categoryPageCount;

  function handleResetFilters() {
    setGlobalFilter("");
    setColumnFilters([]);
    setSorting([]);
  }

  const hasActiveFilters =
    globalFilter.trim() !== "" ||
    columnFilters.length > 0 ||
    sorting.length > 0;

  const activeResource = isClusterTab ? "Cluster" : "Category";

  useEffect(() => {
    onCreateSuccessReady?.({
      refreshClusters,
      refreshCategories,
    });
  }, []);

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
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
              count: clusters.length,
              icon: FiLayers,
            },
            {
              id: "categories",
              label: "Categories",
              count: categories.length,
              icon: FiTag,
            },
          ],
          activeTab: currentTab,
          onTabChange: (tab) => {
            setCurrentTab(tab);

            setPagination({
              pageIndex: 0,
              pageSize: pagination.pageSize,
            });
          },

          searchPlaceholder: isClusterTab
            ? "Search clusters..."
            : "Search categories...",

          footerMetaText: `Showing ${data.length} ${activeResource.toLowerCase()}s`,

          emptyState: {
            title: `No ${activeResource.toLowerCase()}s found`,
            description: "Try adjusting your search or create a new entry.",
            icon: <FaLayerGroup className="h-10 w-10 text-text-secondary" />,
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
        }}
      />

      <CreateClusterModal
        isOpen={isCreateClusterOpen}
        onClose={() => setIsCreateClusterOpen(false)}
        onSuccess={async () => {
          await refetchClusters();
          toast.success("Cluster created successfully.");
        }}
      />

      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        onSuccess={async () => {
          await refetchCategories();
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
      />
    </>
  );
}
