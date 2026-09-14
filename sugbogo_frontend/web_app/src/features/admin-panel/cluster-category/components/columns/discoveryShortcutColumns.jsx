import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";

import { CLUSTER_ICONS } from "../../constants/clusterIcons";

const columnHelper = createColumnHelper();

export default function getDiscoveryShortcutColumns(onEdit, onDelete) {
  return [
    columnHelper.accessor("cluster.name", {
      id: "cluster",
      header: "Cluster",
      cell: ({ row }) => {
        const cluster = row.original.cluster;
        const Icon = CLUSTER_ICONS.find(
          (item) => item.value === cluster.icon,
        )?.icon;

        return (
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="h-5 w-5 text-text-secondary" />}
            <span className="text-sm text-text-primary">{cluster.name}</span>
          </div>
        );
      },
    }),

    columnHelper.accessor("title", {
      header: "Title",
      cell: (info) => (
        <span className="text-sm font-medium text-text-primary">
          {info.getValue()}
        </span>
      ),
    }),

    columnHelper.accessor("subtitle", {
      header: "Subtitle",
      cell: (info) => (
        <span className="text-sm text-text-secondary">{info.getValue()}</span>
      ),
    }),

    columnHelper.accessor("business_count", {
      header: "Active Businesses",
      cell: (info) => (
        <span className="text-sm text-text-primary">{info.getValue()}</span>
      ),
    }),

    columnHelper.accessor("is_active", {
      header: "Status",
      enableSorting: false,
      cell: (info) => (
        <StatusBadge variant={info.getValue() ? "success" : "neutral"}>
          {info.getValue() ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    }),

    columnHelper.display({
      id: "actions",
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
            onClick={() => onEdit(row.original)}
          />

          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            iconOnly
            onClick={() => onDelete(row.original)}
          />
        </div>
      ),
    }),
  ];
}
