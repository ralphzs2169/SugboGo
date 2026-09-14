import { ChevronDown, ChevronRight, Plus, Route, Search } from "lucide-react";

import TablePagination from "@/features/admin-panel/components/data-table/TablePagination";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";

/**
 * Browses paginated route codes hierarchically and reveals directional
 * variants for the currently expanded route.
 */
export default function RouteBrowser({
  routes,
  routeDetail,
  expandedRouteId,
  selectedRouteId,
  selectedVariantId,
  search,
  isSearching,
  isLoading,
  detailLoading,
  error,
  detailError,
  pagination,
  pageCount,
  totalItems,
  interactionDisabled,
  onSearchChange,
  onPageChange,
  onRouteSelect,
  onVariantSelect,
  onRetry,
  onDetailRetry,
  onAddRoute,
}) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-stroke bg-background p-4">
      {/* Browser heading */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">Routes</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Route codes and directional paths
          </p>
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
          {totalItems}
        </span>
      </div>

      {/* Route search */}
      <div className="relative mt-4">
        {isSearching ? (
          <span className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-stroke-strong border-t-primary" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        )}
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search route codes..."
          aria-label="Search jeepney routes"
          className="h-9 w-full rounded-md border border-stroke-strong bg-background py-2 pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-slate-400 focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
        />
      </div>

      {/* Hierarchical route results */}
      <div className="themed-scrollbar mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: pagination.pageSize }, (_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-lg bg-skeleton"
            />
          ))
        ) : error ? (
          <DataErrorState
            title="Unable to load routes"
            message="The route browser could not be loaded."
            onRetry={onRetry}
          />
        ) : routes.length ? (
          routes.map((route) => {
            const isExpanded = String(route.id) === String(expandedRouteId);
            const isSelected = String(route.id) === String(selectedRouteId);

            return (
              <div
                key={route.id}
                className="overflow-hidden rounded-lg border border-stroke bg-surface"
              >
                <button
                  type="button"
                  disabled={interactionDisabled}
                  onClick={() => onRouteSelect(route)}
                  className={`flex w-full cursor-pointer items-center gap-2 px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? "bg-primary/5 text-primary"
                      : "text-text-primary hover:bg-interaction-hover"
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <Route className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {route.code}
                  </span>
                  <span className="text-[11px] text-text-secondary">
                    {route.variant_count}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-stroke bg-background p-2">
                    {detailLoading ? (
                      <div className="space-y-2">
                        <div className="h-10 animate-pulse rounded-md bg-skeleton" />
                        <div className="h-10 animate-pulse rounded-md bg-skeleton" />
                      </div>
                    ) : detailError ? (
                      <button
                        type="button"
                        onClick={onDetailRetry}
                        className="w-full cursor-pointer rounded-md px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/5"
                      >
                        Unable to load variants. Retry
                      </button>
                    ) : routeDetail?.variants?.length ? (
                      <div className="space-y-1">
                        {routeDetail.variants.map((variant) => {
                          const isVariantSelected =
                            String(variant.id) === String(selectedVariantId);

                          return (
                            <button
                              key={variant.id}
                              type="button"
                              disabled={interactionDisabled}
                              onClick={() => onVariantSelect(variant)}
                              className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                isVariantSelected
                                  ? "bg-primary text-white"
                                  : "text-text-secondary hover:bg-interaction-hover hover:text-text-primary"
                              }`}
                            >
                              {variant.origin.name} → {variant.destination.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-3 py-3 text-xs text-text-secondary">
                        No directional variants yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-stroke-strong px-4 py-7 text-center">
            <Route className="mx-auto h-8 w-8 text-text-secondary" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              {search ? "No routes found" : "No routes yet"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {search
                ? "Try a different route code."
                : "Create a jeepney route to begin building the network."}
            </p>
          </div>
        )}
      </div>

      {/* Browser actions and pagination */}
      {!error && !isLoading && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageCount={pageCount}
          totalItems={totalItems}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
        />
      )}
      <Button
        className="mt-4 w-full"
        icon={Plus}
        disabled={interactionDisabled}
        onClick={onAddRoute}
      >
        Add Route
      </Button>
    </section>
  );
}
