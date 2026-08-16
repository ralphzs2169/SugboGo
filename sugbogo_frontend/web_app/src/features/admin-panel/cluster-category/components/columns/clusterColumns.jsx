import { createColumnHelper } from "@tanstack/react-table";
import Button from "@/shared/components/Button";
import { Pencil, Trash2 } from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
const columnHelper = createColumnHelper();
import { formatDate } from "@/shared/utils/dateUtils";
import { CLUSTER_ICONS } from "../../constants/clusterIcons";

/**
 * Creates TanStack Table column definitions for cluster management.

 */
export default function getClusterColumns(onEditCluster, onDeleteCluster) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 50,
      meta: {
        skeleton: "number",
      },
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;

        return pageIndex * pageSize + row.index + 1;
      },
    }),

    columnHelper.accessor("name", {
      header: "Cluster Name",
      size: 200,
      minSize: 150,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const cluster = info.row.original;

        const clusterIcon = CLUSTER_ICONS.find(
          (icon) => icon.value === cluster.icon,
        );

        const Icon = clusterIcon?.icon;

        return (
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center  text-text-secondary">
              {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {cluster.name}
              </p>

              <p className="mt-1 truncate text-xs text-text-secondary">
                {cluster.description || "No description"}
              </p>
            </div>
          </div>
        );
      },
    }),

    columnHelper.accessor("category_count", {
      header: "Categories",
      meta: {
        skeleton: "number",
      },
      cell: (info) => (
        <span className="text-sm text-text-primary">
          {info.getValue() ?? 0}
        </span>
      ),
    }),

    columnHelper.accessor("msme_count", {
      header: "Businesses",
      meta: {
        skeleton: "number",
      },
      cell: (info) => (
        <span className="text-sm text-text-primary">
          {info.getValue() ?? 0}
        </span>
      ),
    }),

    columnHelper.accessor("created_at", {
      header: "Created",
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDate(info.getValue())}
        </span>
      ),
    }),

    columnHelper.accessor("updated_at", {
      header: "Last Updated",
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDate(info.getValue())}
        </span>
      ),
    }),

    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: {
        skeleton: "actions",
      },
      enableSorting: false,
      cell: ({ row }) => {
        const cluster = row.original;
        const hasCategories = cluster.category_count > 0;

        const deleteButton = (
          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            iconOnly
            disabled={hasCategories}
            onClick={() => onDeleteCluster(cluster)}
            disabledTooltip={
              hasCategories
                ? "Cannot be deleted because it has associated categories."
                : undefined
            }
          />
        );

        return (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              iconOnly
              onClick={() => onEditCluster(cluster)}
            />

            {hasCategories ? (
              <Tooltip
                content="Cannot be deleted because it has associated categories."
                place="top"
              >
                {deleteButton}
              </Tooltip>
            ) : (
              deleteButton
            )}
          </div>
        );
      },
    }),
  ];
}
