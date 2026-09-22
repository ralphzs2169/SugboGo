import { useState } from "react";
import { Layers, RotateCw, Tag, Tags, Gem } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import useBusinessTableState from "@/features/admin-panel/businesses/hooks/useBusinessTableState";
import useClusters from "@/features/admin-panel/cluster-category/hooks/useClusters";
import useCategories from "@/features/admin-panel/cluster-category/hooks/useCategories";
import useSpecialtyTags from "@/features/admin-panel/specialty-tags/hooks/useSpecialtyTags";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import getDiscoveryScoreColumns from "../discovery-scores/columns/discoveryScoreColumns";
import useDiscoveryScores from "../discovery-scores/hooks/useDiscoveryScores";
import { recomputeDiscoveryScores } from "../discovery-scores/services/discoveryScoreService";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

/** Monitors persisted Discovery Scores and confirms Admin batch recomputation. */
export default function DiscoveryScoresPage() {
  useDocumentTitle("Discovery Scores | SugboGo Admin");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const {
    globalFilter,
    setGlobalFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
    isSearching,
    statusFilter,
    setStatusFilter,
    clusterFilter,
    setClusterFilter,
    categoryFilter,
    setCategoryFilter,
    specialtyTagFilter,
    setSpecialtyTagFilter,
  } = useBusinessTableState();
  const {
    scores,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useDiscoveryScores(params);
  const { clusters } = useClusters({ page_size: 100 });
  const { categories } = useCategories({ page_size: 100 });
  const { specialtyTags } = useSpecialtyTags({ page_size: 100 });

  useApiErrorNotification(error, {
    toastId: "discovery-scores-load-error",
    fallbackMessage: "Unable to load Discovery Scores. Please try again.",
  });

  async function handleRecompute() {
    if (isRecomputing) return;
    setIsRecomputing(true);
    try {
      const summary = await recomputeDiscoveryScores();
      setConfirmOpen(false);
      await refetch();
      toast.success(
        `${summary.updated} businesses updated. ${summary.failed} failed.`,
      );
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message ||
          "Unable to recompute Discovery Scores. Please try again.",
      );
    } finally {
      setIsRecomputing(false);
    }
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

  return (
    <>
      {/* Page identity follows the existing Admin header pattern. */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin" },
          { label: "Analytics" },
          { label: "Discovery Scores" },
        ]}
        title="Discovery Scores"
      />
      <p className="mb-6 text-sm text-text-secondary">
        Monitor the scores used to surface businesses in Hidden Gems.
      </p>

      {/* The shared table owns search, skeleton, empty, error, and pagination UI. */}
      <DataTable
        data={scores}
        columns={getDiscoveryScoreColumns()}
        isLoading={isLoading}
        isFetching={isFetching}
        isSearching={isSearching}
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
        config={{
          searchPlaceholder: "Search businesses...",
          emptyState: {
            title: "No Discovery Scores yet",
            description: "Scores appear after the first recomputation.",
            icon: <Gem className="h-10 w-10 text-text-secondary" />,
          },
          noResultsState: { title: "No scored businesses found" },
          errorState: {
            title: "Unable to load Discovery Scores",
            message: "The score records could not be loaded.",
          },
        }}
        slots={{
          renderFilters,
          renderHeaderActions: () => (
            <Button
              variant="secondary"
              size="md"
              icon={RotateCw}
              onClick={() => setConfirmOpen(true)}
              disabled={isRecomputing}
            >
              Recompute Discovery Scores
            </Button>
          ),
        }}
      />

      {/* Confirmation keeps the batch action deliberate and prevents duplicates. */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!isRecomputing) setConfirmOpen(false);
        }}
        title="Recompute Discovery Scores?"
        description="This will recalculate Discovery Scores for all active businesses using the latest available specialty and visibility data."
      >
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(false)}
            disabled={isRecomputing}
          >
            Cancel
          </Button>
          <Button onClick={handleRecompute} loading={isRecomputing}>
            Recompute
          </Button>
        </div>
      </Modal>
    </>
  );
}
