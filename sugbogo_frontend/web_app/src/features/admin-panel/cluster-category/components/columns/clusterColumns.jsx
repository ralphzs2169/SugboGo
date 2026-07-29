import { createColumnHelper } from "@tanstack/react-table";
import Button from "@/shared/components/Button";
import { Pencil, Trash2 } from "lucide-react";
import DisabledActionTooltip from "@/shared/components/actions/DisabledActionTooltip";
const columnHelper = createColumnHelper();
import { formatDateTime } from "@/shared/utils/dateUtils";

/**
 * Creates TanStack Table column definitions for cluster management.
 *
 * @param {Function} onEditCluster - Callback triggered when a cluster is edited.
 * @param {Function} onDeleteCluster - Callback triggered when a cluster is deleted.
 *
 * @returns {Array<Object>} TanStack Table column configuration.
 */
export default function getClusterColumns(onEditCluster, onDeleteCluster) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 40,
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;

        return pageIndex * pageSize + row.index + 1;
      },
    }),

    columnHelper.accessor("name", {
      header: "Cluster Name",
      size: 250,
      minSize: 200,
      cell: (info) => {
        const cluster = info.row.original;

        return (
          <div>
            <p className="text-sm font-medium text-text-primary">
              {cluster.name}
            </p>

            <p className="mt-1 text-xs text-text-secondary">
              {cluster.description || "No description"}
            </p>
          </div>
        );
      },
    }),

    columnHelper.accessor("category_count", {
      header: "Categories",
      cell: (info) => (
        <span className="text-sm text-text-primary">
          {info.getValue() ?? 0}
        </span>
      ),
    }),

    columnHelper.accessor("msme_count", {
      header: "MSMEs",
      cell: (info) => (
        <span className="text-sm text-text-primary">
          {info.getValue() ?? 0}
        </span>
      ),
    }),

    columnHelper.accessor("created_at", {
      header: "Created",
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),

    columnHelper.display({
      id: "actions",
      header: "Actions",
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
              <DisabledActionTooltip
                id={`delete-cluster-${cluster.id}`}
                message="Cannot be deleted because it has associated categories."
              >
                {deleteButton}
              </DisabledActionTooltip>
            ) : (
              deleteButton
            )}
          </div>
        );
      },
    }),
  ];
}
