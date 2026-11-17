import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, List } from "lucide-react";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import Button from "@/shared/components/Button";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/data-table/DataTable";
import SortMenu from "../components/data-table/SortMenu";
import RowsPerPageMenu from "../components/data-table/RowsPerPageMenu";
import PaymentMetrics from "../payments/components/PaymentMetrics";
import PaymentFilters from "../payments/components/PaymentFilters";
import PaymentDrawer from "../payments/components/PaymentDrawer";
import paymentColumns from "../payments/columns/paymentColumns";
import usePaymentTableState from "../payments/hooks/usePaymentTableState";
import { paymentListOptions } from "../payments/queries/paymentQueries";

/** Provide the read-only Admin directory using the existing Businesses table shell. */
export default function PaymentsPage() {
  useDocumentTitle("Payments | SugboGo Admin");
  const table = usePaymentTableState();
  const { state } = table;
  const list = useQuery({
    ...paymentListOptions(table.params),
    enabled: !table.isSearching,
  });
  const columns = useMemo(
    () => paymentColumns(table.selectPayment),
    [table.selectPayment],
  );
  useApiErrorNotification(list.error, {
    toastId: "admin-payments-list-load-error",
    fallbackMessage: "Unable to load payments. Please try again.",
  });

  const metadata = list.data?.pagination;
  const pagination = {
    pageIndex: metadata ? metadata.page - 1 : state.page - 1,
    pageSize: metadata?.page_size ?? state.page_size,
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Payments"
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel" },
          { label: "Management" },
          { label: "Payments" },
        ]}
      />
      <p className="mb-6 text-sm text-text-secondary">
        Inspect Merchant Plus purchases and stored payment evidence. Read-only.
      </p>
      <PaymentMetrics filters={state} onFilterChange={table.changeFilters} />
      <section aria-label="Payments directory" className="min-w-0">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <List aria-hidden="true" className="h-4 w-4 shrink-0" />
          Payments directory
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
            tableLabel: "All payments",
            tableMinWidth: 1185,
            scrollbarClassName: "themed-scrollbar",
            searchPlaceholder:
              "Search reference, merchant, business, or provider payment ID…",
            emptyState: {
              title: "No payments yet",
              description: "Merchant Plus purchases will appear here.",
              icon: (
                <CreditCard
                  aria-hidden="true"
                  className="h-10 w-10 text-text-secondary"
                />
              ),
            },
            noResultsState: {
              title: "No payments match your criteria",
              description: (
                <span>
                  Try another search or date range.{" "}
                  <button
                    type="button"
                    onClick={table.resetFilters}
                    className="rounded font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-info"
                  >
                    Clear payment filters
                  </button>
                </span>
              ),
            },
            errorState: {
              title: "Unable to load payments",
              message:
                "The payments could not be loaded. Your search and filters are preserved.",
            },
          }}
          slots={{
            renderFilters: () => (
              <PaymentFilters filters={state} onChange={table.changeFilters} />
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
                    { value: "amount_highest", label: "Amount: highest first" },
                    { value: "amount_lowest", label: "Amount: lowest first" },
                  ]}
                  ariaLabel="Sort payments"
                  onChange={(ordering) => table.changeFilters({ ordering })}
                />
                <RowsPerPageMenu
                  ariaLabel="Payments per page"
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
      {state.paymentId && (
        <PaymentDrawer
          key={state.paymentId}
          paymentId={state.paymentId}
          onClose={() => table.selectPayment(null)}
        />
      )}
    </div>
  );
}
