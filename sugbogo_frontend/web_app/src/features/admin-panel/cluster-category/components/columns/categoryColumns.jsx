import { createColumnHelper } from "@tanstack/react-table";
import Button from "@/shared/components/Button";
import { Pencil, Trash2 } from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import { formatDate } from "@/shared/utils/dateUtils";

import { CLUSTER_ICONS } from "../../constants/clusterIcons";

const columnHelper = createColumnHelper();

/**
 * Creates TanStack Table column definitions for category management.
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
      size: 250,
      minSize: 200,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const category = info.row.original;

        return (
          <div>
            <p className="text-sm font-semibold text-text-primary">
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
      cell: (info) => {
        const category = info.row.original;

        const clusterIcon = CLUSTER_ICONS.find(
          (icon) => icon.value === category.cluster_icon,
        );

        const Icon = clusterIcon?.icon;

        return (
          <div className="flex items-center gap-2.5">
            <div className="flex shrink-0 items-center justify-center text-text-secondary">
              {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
            </div>

            <span className="text-sm text-text-primary">
              {category.cluster_name}
            </span>
          </div>
        );
      },
    }),

    columnHelper.accessor("msme_count", {
      header: "Businesses",
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
        const category = row.original;
        const hasApplications = category.application_count > 0;

        const deleteButton = (
          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            iconOnly
            disabled={hasApplications}
            onClick={() => onDeleteCategory(category)}
            disabledTooltip={
              hasApplications
                ? "Cannot be deleted because it is referenced by merchant applications."
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
              onClick={() => onEditCategory(category)}
            />

            {hasApplications ? (
              <Tooltip
                content="Cannot be deleted because it is referenced by merchant applications."
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
