import { ArrowRightLeft, MapPin } from "lucide-react";

import TablePagination from "@/features/admin-panel/components/data-table/TablePagination";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import StatusBadge from "@/shared/components/StatusBadge";

import { formatVariantLabel } from "../../utils/transitFormatters";

const STATUS_VARIANTS = {
  pending: "warning",
  confirmed: "success",
  ignored: "muted",
};

/**
 * Browses directed transfer records using the existing server-side status and
 * pagination contract.
 */
export default function TransferBrowser({
  transfers,
  selectedTransferId,
  isLoading,
  error,
  pagination,
  pageCount,
  totalItems,
  interactionDisabled,
  onTransferSelect,
  onPageChange,
  onRetry,
}) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-stroke bg-background p-4">
      {/* Browser heading */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">Transfers</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Directed reviewed connections
          </p>
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
          {totalItems}
        </span>
      </div>

      {/* Transfer results */}
      <div className="themed-scrollbar mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: pagination.pageSize }, (_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-lg bg-skeleton"
            />
          ))
        ) : error ? (
          <DataErrorState
            title="Unable to load transfers"
            message="The transfer browser could not be loaded."
            onRetry={onRetry}
          />
        ) : transfers.length ? (
          transfers.map((transfer) => {
            const isSelected =
              String(transfer.id) === String(selectedTransferId);

            return (
              <button
                key={transfer.id}
                type="button"
                disabled={interactionDisabled}
                onClick={() => onTransferSelect(transfer)}
                className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-stroke bg-surface hover:border-stroke-active hover:bg-interaction-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-xs font-semibold text-text-primary">
                    {formatVariantLabel(transfer.source_variant)}
                  </span>
                  <StatusBadge
                    variant={STATUS_VARIANTS[transfer.status] ?? "neutral"}
                  >
                    {transfer.status}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {transfer.alighting_transit_point?.name} → {" "}
                    {transfer.boarding_transit_point?.name}
                  </span>
                </div>
                <p className="mt-2 truncate text-[11px] text-text-secondary">
                  To {formatVariantLabel(transfer.destination_variant)}
                </p>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-stroke-strong px-4 py-7 text-center">
            <ArrowRightLeft className="mx-auto h-8 w-8 text-text-secondary" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              No transfers found
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Create a connection manually or scan the network for suggestions.
            </p>
          </div>
        )}
      </div>

      {/* Transfer pagination */}
      {!error && !isLoading && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageCount={pageCount}
          totalItems={totalItems}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
        />
      )}
    </section>
  );
}
