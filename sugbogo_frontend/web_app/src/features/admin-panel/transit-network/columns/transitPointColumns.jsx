import { createColumnHelper } from "@tanstack/react-table";
import { Edit3, Eye, MapPin } from "lucide-react";

import Button from "@/shared/components/Button";
import { formatDate } from "@/shared/utils/dateUtils";

const columnHelper = createColumnHelper();

/**
 * Creates columns for managed transit infrastructure points and coordinates.
 */
export default function getTransitPointColumns(onView, onEdit) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 60,
      meta: { skeleton: "number" },
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;

        return pageIndex * pageSize + row.index + 1;
      },
    }),
    columnHelper.accessor((point) => point.name, {
      id: "name",
      header: "Transit Point",
      size: 310,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <div className="flex items-center gap-3">
          {/* Transit point identity */}
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-action-icon-background text-primary">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {info.getValue()}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              SugboGo transit infrastructure
            </p>
          </div>
        </div>
      ),
    }),
    columnHelper.display({
      id: "coordinates",
      header: "Coordinates",
      size: 250,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-text-secondary">
          {Number(row.original.latitude).toFixed(6)}, {" "}
          {Number(row.original.longitude).toFixed(6)}
        </span>
      ),
    }),
    columnHelper.accessor((point) => point.updated_at, {
      id: "updated_at",
      header: "Last Updated",
      size: 170,
      enableSorting: false,
      meta: { skeleton: "text" },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDate(info.getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      size: 120,
      enableSorting: false,
      meta: { skeleton: "actions" },
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          {/* Transit point actions */}
          <Button
            variant="action"
            icon={Eye}
            iconOnly
            tooltipMessage="View transit point"
            aria-label={`View transit point ${row.original.name}`}
            onClick={() => onView(row.original)}
          />
          <Button
            variant="action"
            icon={Edit3}
            iconOnly
            tooltipMessage="Edit transit point"
            aria-label={`Edit transit point ${row.original.name}`}
            onClick={() => onEdit(row.original)}
          />
        </div>
      ),
    }),
  ];
}
