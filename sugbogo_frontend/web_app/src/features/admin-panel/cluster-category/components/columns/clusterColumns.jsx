import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Button from "@/shared/components/Button";
import Tooltip from "@/shared/components/actions/Tooltip";
import { formatCount } from "@/features/admin-panel/analytics/utils/presentation";
import { CLUSTER_ICONS } from "../../constants/clusterIcons";
import DateAddedCell from "../../../components/data-table/DateAddedCell";

const columnHelper = createColumnHelper();

/** Present current cluster usage with the existing protected management actions. */
export default function getClusterColumns(
  onEditCluster,
  onDeleteCluster,
) {
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
    columnHelper.accessor("name", {
      header: "Cluster",
      size: 260,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const cluster = row.original;
        const Icon = CLUSTER_ICONS.find(
          (icon) => icon.value === cluster.icon,
        )?.icon;

        return (
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {cluster.name}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {cluster.description || "No description"}
              </p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("category_count", {
      header: "Categories",
      size: 128,
      meta: { skeleton: "number", align: "center" },
      cell: (info) => (
        <span className="text-sm tabular-nums text-text-primary">
          {formatCount(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("business_count", {
      header: "Businesses",
      size: 136,
      meta: { skeleton: "number", align: "center" },
      cell: (info) => (
        <span className="text-sm tabular-nums text-text-primary">
          {formatCount(info.getValue())}
        </span>
      ),
    }),

    columnHelper.accessor("created_at", {
      header: "Date Added",
      size: 148,
      meta: { skeleton: "text" },
      cell: (info) => <DateAddedCell value={info.getValue()} />,
    }),
    columnHelper.display({
      id: "actions",
      size: 112,
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
            aria-label={`Delete ${cluster.name}`}
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
              aria-label={`Edit ${cluster.name}`}
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
