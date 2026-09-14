import { MapPin, Search } from "lucide-react";

import TablePagination from "@/features/admin-panel/components/data-table/TablePagination";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";

/**
 * Renders the searchable, paginated Transit Point list synchronized with the
 * markers shown on the current map result page.
 */
export default function TransitPointList({
  transitPoints,
  selectedPointId,
  search,
  isSearching,
  isLoading,
  error,
  pagination,
  pageCount,
  totalItems,
  selectionDisabled,
  onSearchChange,
  onPageChange,
  onPointSelect,
  onRetry,
  onStartAdd,
}) {
  return (
    <div className="min-h-0 flex-1 rounded-xl border border-stroke bg-background p-4">
      {/* List heading and search */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-text-primary">Transit Points</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Map and list show the current result page.
          </p>
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
          {totalItems}
        </span>
      </div>
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
          placeholder="Search Transit Points..."
          aria-label="Search Transit Points"
          className="h-9 w-full rounded-md border border-stroke-strong bg-background py-2 pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-slate-400 focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10"
        />
      </div>

      {/* Result list */}
      <div className="mt-4 max-h-72 overflow-y-auto pr-1 lg:max-h-[34vh]">
        {isLoading ? (
          <div className="space-y-2" aria-label="Loading Transit Points">
            {Array.from({ length: pagination.pageSize }, (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-lg bg-skeleton"
              />
            ))}
          </div>
        ) : error ? (
          <DataErrorState
            title="Unable to load Transit Points"
            message="The managed Transit Point list could not be loaded."
            onRetry={onRetry}
          />
        ) : transitPoints.length ? (
          <div className="space-y-2">
            {transitPoints.map((point) => {
              const isSelected = String(point.id) === String(selectedPointId);

              return (
                <button
                  key={point.id}
                  type="button"
                  disabled={selectionDisabled}
                  onClick={() => onPointSelect(point)}
                  className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-stroke bg-surface hover:border-stroke-active hover:bg-interaction-hover"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isSelected
                        ? "bg-primary text-white"
                        : "bg-action-icon-background text-primary"
                    }`}
                  >
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text-primary">
                      {point.name}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] tabular-nums text-text-secondary">
                      {Number(point.latitude).toFixed(6)}, {" "}
                      {Number(point.longitude).toFixed(6)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stroke-strong bg-surface px-4 py-7 text-center">
            <MapPin className="mx-auto h-8 w-8 text-text-secondary" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              {search ? "No Transit Points found" : "No Transit Points yet"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {search
                ? "Try a different search term."
                : "Add boarding, alighting, and transfer locations to begin building the network."}
            </p>
            {!search && (
              <Button className="mt-4" size="sm" onClick={onStartAdd}>
                Add First Point
              </Button>
            )}
          </div>
        )}
      </div>

      {!error && !isLoading && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageCount={pageCount}
          totalItems={totalItems}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
