import { createColumnHelper } from "@tanstack/react-table";
import { MoreVertical } from "lucide-react";

const columnHelper = createColumnHelper();

/**
 * Creates TanStack Table column definitions for category management.
 *
 * @returns {Array<Object>} TanStack Table column configuration.
 */
export function getCategoryColumns() {
  return [
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
              {category.description}
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

    columnHelper.display({
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: () => (
        <button
          className="
            rounded-lg p-1
            text-text-secondary
            hover:bg-interaction-hover
            transition
          "
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      ),
    }),
  ];
}
