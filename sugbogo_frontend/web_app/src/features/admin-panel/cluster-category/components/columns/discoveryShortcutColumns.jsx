import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatCount } from "@/features/admin-panel/analytics/utils/presentation";

import { CLUSTER_ICONS } from "../../constants/clusterIcons";

const columnHelper = createColumnHelper();

export default function getDiscoveryShortcutColumns(onEdit, onDelete) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 56,
      meta: { skeleton: "number", align: "center" },
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return pageIndex * pageSize + row.index + 1;
      },
    }),
    columnHelper.accessor("cluster.name", {
      id: "cluster",
      header: "Cluster",
      size: 160,
      enableSorting: false,
      cell: ({ row }) => {
        const cluster = row.original.cluster;
        const Icon = CLUSTER_ICONS.find(
          (item) => item.value === cluster.icon,
        )?.icon;

        return (
          <div className="flex items-center gap-2.5">
            {Icon && <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" />}
            <span className="text-sm text-text-primary">{cluster.name}</span>
          </div>
        );
      },
    }),

    columnHelper.accessor("title", {
      header: "Title / Subtitle",
      size: 280,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {row.original.title}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {row.original.subtitle}
          </p>
        </div>
      ),
    }),

    columnHelper.accessor("business_count", {
      header: "Active Businesses",
      size: 160,
      meta: { skeleton: "number", align: "center" },
      cell: (info) => (
        <span className="text-sm tabular-nums text-text-primary">
          {formatCount(info.getValue())}
        </span>
      ),
    }),

    columnHelper.accessor("is_active", {
      header: "Status",
      size: 112,
      enableSorting: false,
      cell: (info) => (
        <StatusBadge variant={info.getValue() ? "success" : "neutral"}>
          {info.getValue() ? "Enabled" : "Disabled"}
        </StatusBadge>
      ),
    }),

    columnHelper.display({
      id: "actions",
      size: 112,
      header: "Actions",
      enableSorting: false,
      meta: { skeleton: "actions" },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            iconOnly
            aria-label={`Edit ${row.original.title}`}
            onClick={() => onEdit(row.original)}
          />

          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            iconOnly
            aria-label={`Delete ${row.original.title}`}
            onClick={() => onDelete(row.original)}
          />
        </div>
      ),
    }),
  ];
}
