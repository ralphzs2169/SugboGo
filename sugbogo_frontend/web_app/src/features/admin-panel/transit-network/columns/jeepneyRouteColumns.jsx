import { createColumnHelper } from "@tanstack/react-table";
import { Edit3, Eye, Route } from "lucide-react";

import Button from "@/shared/components/Button";
import { formatDate } from "@/shared/utils/dateUtils";

const columnHelper = createColumnHelper();

/**
 * Creates columns for route-code management and directional variant summaries.
 */
export default function getJeepneyRouteColumns(onView, onEdit) {
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
    columnHelper.accessor((route) => route.code, {
      id: "code",
      header: "Jeepney Route",
      size: 280,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <div className="flex items-center gap-3">
          {/* Route identity */}
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-action-icon-background text-primary">
            <Route className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-text-primary">
              {info.getValue()}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Managed route code
            </p>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor((route) => route.variant_count, {
      id: "variant_count",
      header: "Directional Variants",
      size: 210,
      enableSorting: false,
      meta: { skeleton: "text" },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {info.getValue()} {info.getValue() === 1 ? "variant" : "variants"}
        </span>
      ),
    }),
    columnHelper.accessor((route) => route.updated_at, {
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
          {/* Route actions */}
          <Button
            variant="action"
            icon={Eye}
            iconOnly
            tooltipMessage="View route"
            aria-label={`View route ${row.original.code}`}
            onClick={() => onView(row.original)}
          />
          <Button
            variant="action"
            icon={Edit3}
            iconOnly
            tooltipMessage="Edit route"
            aria-label={`Edit route ${row.original.code}`}
            onClick={() => onEdit(row.original)}
          />
        </div>
      ),
    }),
  ];
}
