import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, List } from "lucide-react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import Button from "@/shared/components/Button";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/data-table/DataTable";
import SortMenu from "../components/data-table/SortMenu";
import RowsPerPageMenu from "../components/data-table/RowsPerPageMenu";
import AllReviewMetrics from "../all-reviews/components/AllReviewMetrics";
import AllReviewFilters from "../all-reviews/components/AllReviewFilters";
import AllReviewDrawer from "../all-reviews/components/AllReviewDrawer";
import allReviewColumns from "../all-reviews/columns/allReviewColumns";
import useAllReviewTableState from "../all-reviews/hooks/useAllReviewTableState";
import { allReviewListOptions } from "../all-reviews/queries/allReviewQueries";

/** Provide the read-only Admin directory using the existing Businesses table shell. */
export default function AllReviewsPage() {
  useDocumentTitle("All Reviews | SugboGo Admin");
  const table = useAllReviewTableState();
  const { state } = table;
  const list = useQuery({
    ...allReviewListOptions(table.params),
    enabled: !table.isSearching,
  });
  const columns = useMemo(
    () => allReviewColumns(table.selectReview),
    [table.selectReview],
  );
  const metadata = list.data?.pagination;
  const pagination = {
    pageIndex: metadata ? metadata.page - 1 : state.page - 1,
    pageSize: metadata?.page_size ?? state.page_size,
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="All Reviews"
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel" },
          { label: "Management" },
          { label: "All Reviews" },
        ]}
      />
      {state.business_id ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          <span>Reviews for business #{state.business_id}</span>
          <button
            type="button"
            className="cursor-pointer text-primary underline focus-visible:outline-2 focus-visible:outline-info"
            onClick={() => table.changeFilters({ business_id: null })}
          >
            Show all businesses
          </button>
        </div>
      ) : (
        <p className="mb-6 text-sm text-text-secondary">
          Inspect reviews submitted across SugboGo.
        </p>
      )}
      <AllReviewMetrics filters={state} onFilterChange={table.changeFilters} />
      <section aria-label="Reviews directory" className="min-w-0">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          Reviews directory
        </h2>
        <DataTable
          data={list.data?.items ?? []}
          columns={columns}
          isLoading={list.isLoading || table.isSearching}
          isFetching={list.isFetching}
          isSearching={table.isSearching}
          error={list.error}
          onRetry={() => list.refetch()}
          state={{ globalFilter: state.search, sorting: [] }}
          pagination={pagination}
          pageCount={metadata?.total_pages ?? 0}
          totalItems={metadata?.total_items ?? 0}
          onPaginationChange={table.changePagination}
          onGlobalFilterChange={(search) => table.changeFilters({ search })}
          hasActiveFilters={table.hasActiveFilters}
          onResetFilters={table.resetFilters}
          config={{
            tableLabel: "All reviews",
            tableMinWidth: 1430,
            scrollbarClassName: "themed-scrollbar",
            searchPlaceholder: "Search reviews, reviewers, or businesses…",
            emptyState: {
              title: "No reviews yet",
              description: "Reviews submitted across SugboGo will appear here.",
              icon: (
                <MessageSquareText
                  aria-hidden="true"
                  className="h-10 w-10 text-text-secondary"
                />
              ),
            },
            noResultsState: {
              title: "No reviews match your criteria",
              description: (
                <span>
                  Try another search or date range.{" "}
                  <button
                    type="button"
                    onClick={table.resetFilters}
                    className="rounded font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-info"
                  >
                    Clear review filters
                  </button>
                </span>
              ),
            },
            errorState: {
              title: "Unable to load reviews",
              message:
                "The reviews could not be loaded. Your search and filters are preserved.",
            },
          }}
          slots={{
            renderFilters: () => (
              <AllReviewFilters
                filters={state}
                onChange={table.changeFilters}
              />
            ),
            renderHeaderActions: () => (
              <div className="flex flex-wrap items-center gap-2">
                {list.error?.response?.status === 404 && state.page > 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      table.changePagination({
                        pageIndex: 0,
                        pageSize: state.page_size,
                      })
                    }
                  >
                    Return to first page
                  </Button>
                )}
                <SortMenu
                  value={state.ordering}
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "oldest", label: "Oldest first" },
                  ]}
                  ariaLabel="Sort reviews"
                  onChange={(ordering) => table.changeFilters({ ordering })}
                />
                <RowsPerPageMenu
                  ariaLabel="Reviews per page"
                  value={state.page_size}
                  onChange={(pageSize) =>
                    table.changePagination({ pageIndex: 0, pageSize })
                  }
                />
              </div>
            ),
          }}
        />
      </section>
      {state.reviewId && (
        <AllReviewDrawer
          key={state.reviewId}
          reviewId={state.reviewId}
          onClose={() => table.selectReview(null)}
        />
      )}
    </div>
  );
}
