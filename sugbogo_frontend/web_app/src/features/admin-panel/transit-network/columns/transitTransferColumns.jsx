import { createColumnHelper } from "@tanstack/react-table";
import { Check, Edit3, Eye, MapPin, X } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";

import { formatVariantLabel } from "../utils/transitFormatters";

const columnHelper = createColumnHelper();
const STATUS_VARIANTS = {
  pending: "warning",
  confirmed: "success",
  ignored: "muted",
};

/**
 * Creates columns for directed transfer connections and review actions.
 */
export default function getTransitTransferColumns({
  onView,
  onEdit,
  onConfirm,
  onIgnore,
}) {
  return [
    columnHelper.accessor((transfer) => transfer.source_variant, {
      id: "source_variant",
      header: "Source Variant",
      size: 260,
      enableSorting: false,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <p className="text-sm font-semibold text-text-primary">
          {formatVariantLabel(info.getValue())}
        </p>
      ),
    }),
    columnHelper.accessor((transfer) => transfer.alighting_transit_point, {
      id: "alighting_point",
      header: "Alight At",
      size: 190,
      enableSorting: false,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{info.getValue()?.name ?? "—"}</span>
        </div>
      ),
    }),
    columnHelper.accessor((transfer) => transfer.boarding_transit_point, {
      id: "boarding_point",
      header: "Board At",
      size: 190,
      enableSorting: false,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{info.getValue()?.name ?? "—"}</span>
        </div>
      ),
    }),
    columnHelper.accessor((transfer) => transfer.destination_variant, {
      id: "destination_variant",
      header: "Destination Variant",
      size: 260,
      enableSorting: false,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <p className="text-sm font-semibold text-text-primary">
          {formatVariantLabel(info.getValue())}
        </p>
      ),
    }),
    columnHelper.accessor((transfer) => transfer.status, {
      id: "status",
      header: "Status",
      size: 130,
      meta: { skeleton: "text" },
      cell: (info) => (
        <StatusBadge variant={STATUS_VARIANTS[info.getValue()] ?? "neutral"}>
          {info.getValue()?.[0]?.toUpperCase() + info.getValue()?.slice(1)}
        </StatusBadge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      size: 190,
      enableSorting: false,
      meta: { skeleton: "actions" },
      cell: ({ row }) => {
        const transfer = row.original;
        const isPending = transfer.status === "pending";

        return (
          <div className="flex items-center justify-center">
            {/* Transfer actions */}
            <Button
              variant="action"
              icon={Eye}
              iconOnly
              tooltipMessage="View transfer"
              aria-label={`View transfer ${transfer.id}`}
              onClick={() => onView(transfer)}
            />
            <Button
              variant="action"
              icon={Edit3}
              iconOnly
              tooltipMessage="Edit connection"
              aria-label={`Edit transfer ${transfer.id}`}
              onClick={() => onEdit(transfer)}
            />
            {isPending && (
              <>
                <Button
                  variant="action"
                  icon={Check}
                  iconOnly
                  tooltipMessage="Confirm transfer"
                  aria-label={`Confirm transfer ${transfer.id}`}
                  className="hover:text-success"
                  onClick={() => onConfirm(transfer)}
                />
                <Button
                  variant="action"
                  icon={X}
                  iconOnly
                  tooltipMessage="Ignore transfer"
                  aria-label={`Ignore transfer ${transfer.id}`}
                  className="hover:text-danger"
                  onClick={() => onIgnore(transfer)}
                />
              </>
            )}
          </div>
        );
      },
    }),
  ];
}
