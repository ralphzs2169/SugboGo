import { createColumnHelper } from "@tanstack/react-table";
import { MoreVertical } from "lucide-react";

const columnHelper = createColumnHelper();

/**
 * Creates TanStack Table column definitions for cluster management.
 *
 * @param {Object|null} selectedCluster - Currently selected cluster used
 * to highlight the active row.
 *
 * @returns {Array<Object>} TanStack Table column configuration.
 */
export function getClusterColumns(selectedCluster) {
  return [
    columnHelper.accessor("name", {
      header: "Cluster Name",
      cell: (info) => {
        const cluster = info.row.original;

        const isSelected = selectedCluster?.id === cluster.id;

        return (
          <div
            className={`
              rounded-lg p-2 transition
              ${isSelected ? "bg-interaction-hover" : ""}
            `}
          >
            <p className="text-sm font-medium text-text-primary">
              {cluster.name}
            </p>

            <p className="mt-1 text-xs text-text-secondary">
              {cluster.description}
            </p>
          </div>
        );
      },
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

    // columnHelper.accessor("category_count", {
    //   header: "Categories",
    //   cell: (info) => (
    //     <span className="text-sm text-text-primary">{info.getValue()}</span>
    //   ),
    // }),
  ];
}
