import { useRef, useState } from "react";
import { BarChart3, Layers, List, RotateCw, Tag, Tags, Gem } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import useBusinessTableState from "@/features/admin-panel/businesses/hooks/useBusinessTableState";
import { useQuery } from "@tanstack/react-query";
import { taxonomyReferenceOptions } from "../taxonomy/queries/taxonomyQueries";
import TaxonomyOptionFeedback from "../taxonomy/components/TaxonomyOptionFeedback";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import PageHeader from "../components/PageHeader";
import getDiscoveryScoreColumns from "../discovery-scores/columns/discoveryScoreColumns";
import useDiscoveryScores from "../discovery-scores/hooks/useDiscoveryScores";
import DiscoveryScoreDetailsModal from "../discovery-scores/components/DiscoveryScoreDetailsModal";
import DiscoveryScoreOverview from "../discovery-scores/components/DiscoveryScoreOverview";
import DiscoveryScoringInfo from "../discovery-scores/components/DiscoveryScoringInfo";
import useRecomputeDiscoveryScores from "../discovery-scores/hooks/useRecomputeDiscoveryScores";
import DataErrorState from "@/shared/components/errors/DataErrorState";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

/** Monitor persisted scores and refresh shared health after confirmed Admin recomputation. */
export default function DiscoveryScoresPage() {
  useDocumentTitle("Discovery Scores | SugboGo Admin");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const recompute = useRecomputeDiscoveryScores();
  const submitting = useRef(false);
  const isRecomputing = recompute.isPending;
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
  const clusterOptionsQuery = useQuery(taxonomyReferenceOptions("clusters"));
  const categoryOptionsQuery = useQuery(taxonomyReferenceOptions("categories"));
  const specialtyOptionsQuery = useQuery(taxonomyReferenceOptions("specialty-tags"));
  const clusters = clusterOptionsQuery.data ?? [];
  const categories = categoryOptionsQuery.data ?? [];
  const specialtyTags = specialtyOptionsQuery.data ?? [];

  useApiErrorNotification(error, {
    toastId: "discovery-scores-load-error",
    fallbackMessage: "Unable to load Discovery Scores. Please try again.",
  });
  useApiErrorNotification(recompute.error, {
    toastId: "discovery-score-recompute-error",
    fallbackMessage: "Unable to recompute Discovery Scores. Please try again.",
  });

  async function handleRecompute() {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const summary = await recompute.mutateAsync();
      setConfirmOpen(false);
      if (summary.status === "COMPLETED_WITH_FAILURES") {
        toast.error(`Recomputation completed with refresh failures: ${summary.updated} updated, ${summary.failed} failed. Previous successful scores were retained.`);
      } else {
        toast.success(`Discovery Scores recomputed successfully. ${summary.updated} businesses updated.`);
      }
    } catch {
      // The mutation exposes the persistent error and the shared notification hook reports it.
    } finally {
      submitting.current = false;
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
      {/* Page identity follows the existing Admin header pattern. */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin" },
          { label: "Insights" },
          { label: "Discovery Scores" },
        ]}
        title="Discovery Scores"
        actions={(
          <Button variant="secondary" icon={RotateCw} loading={isRecomputing}
            onClick={() => { recompute.reset(); setConfirmOpen(true); }}>
            Recompute Discovery Scores
          </Button>
        )}
      />
      <p className="mb-6 text-sm text-text-secondary">
        Monitor business discovery scores, calculation health, and visibility data for Hidden Gems.
      </p>

      <section className="mb-6" aria-label="Discovery Score Overview">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <BarChart3 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Discovery Score Overview
        </h2>
        <p className="-mt-2 mb-3 text-xs text-text-secondary">Current scoring health and freshness · PHT</p>
        <DiscoveryScoreOverview />
      </section>
      <DiscoveryScoringInfo />

      <section aria-label="Business Discovery Scores">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          Business Discovery Scores
        </h2>
        {error && scores.length > 0 && (
          <DataErrorState compact retainedData onRetry={() => refetch()} retrying={isFetching} retryLabel="Retry scores" />
        )}

      {/* The shared table owns search, skeleton, empty, error, and pagination UI. */}
      <TaxonomyOptionFeedback
        query={clusterOptionsQuery}
        resource="clusters"
        label="Cluster"
      />
      <TaxonomyOptionFeedback
        query={categoryOptionsQuery}
        resource="categories"
        label="Category"
      />
      <TaxonomyOptionFeedback
        query={specialtyOptionsQuery}
        resource="specialty-tags"
        label="Specialty Tag"
      />
      <DataTable
        data={scores}
        columns={getDiscoveryScoreColumns(setSelectedBusiness)}
        isLoading={isLoading}
        isFetching={isFetching}
        isSearching={isSearching}
        error={scores.length > 0 ? null : error}
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
          managementControls: true,
          tableLabel: "Business Discovery Scores",
          tableMinWidth: 1200,
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
        }}
      />
      </section>

      {selectedBusiness && (
        <DiscoveryScoreDetailsModal
          key={selectedBusiness.id}
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
        />
      )}

      {/* Confirmation keeps the batch action deliberate and prevents duplicates. */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!isRecomputing) setConfirmOpen(false);
        }}
        title="Recompute Discovery Scores?"
        description="This will recalculate Discovery Scores for all active businesses using the latest available specialty and visibility data."
      >
        {recompute.error && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger/10 p-3 text-sm text-text-primary">
            {recompute.error.response?.data?.message || recompute.error.message || "Recomputation failed. Please try again."}
          </div>
        )}
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
