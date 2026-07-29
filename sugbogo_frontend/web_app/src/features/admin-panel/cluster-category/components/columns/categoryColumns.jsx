import { createColumnHelper } from "@tanstack/react-table";
import Button from "@/shared/components/Button";
import { Pencil, Trash2 } from "lucide-react";
import { formatDateTime } from "@/shared/utils/dateUtils";
const columnHelper = createColumnHelper();

/**
 * Creates TanStack Table column definitions for category management.
 *
 * @param {Function} onEditCategory - Callback triggered when a category is edited.
 * @param {Function} onDeleteCategory - Callback triggered when a category is deleted.
 *
 * @returns {Array<Object>} TanStack Table column configuration.
 */
export default function getCategoryColumns(onEditCategory, onDeleteCategory) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 50,
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;

        return pageIndex * pageSize + row.index + 1;
      },
    }),

    columnHelper.accessor("name", {
      header: "Category Name",
      cell: (info) => {
        const category = info.row.original;

        return (
          <div>
            <p className="text-sm font-medium text-text-primary">
              {category.name}
            </p>

            <p className="mt-1 text-xs text-text-secondary">
              {category.description || "No description"}
            </p>
          </div>
        );
      },
    }),

    columnHelper.accessor("cluster_name", {
      header: "Cluster",
      cell: (info) => (
        <span className="text-sm text-text-primary">{info.getValue()}</span>
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
        const category = row.original;

        return (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              iconOnly
              onClick={() => onEditCategory(category)}
            />

            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              iconOnly
              onClick={() => onDeleteCategory(category)}
            />
          </div>
        );
      },
    }),
  ];
}
