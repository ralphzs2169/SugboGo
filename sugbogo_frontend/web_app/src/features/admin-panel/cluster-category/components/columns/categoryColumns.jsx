import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Button from "@/shared/components/Button";
import Tooltip from "@/shared/components/actions/Tooltip";
import { formatCount } from "@/features/admin-panel/analytics/utils/presentation";
import { CLUSTER_ICONS } from "../../constants/clusterIcons";

const columnHelper = createColumnHelper();

/** Keep category hierarchy, current businesses, and application references distinct. */
export default function getCategoryColumns(
  onEditCategory,
  onDeleteCategory,
) {
  return [
    columnHelper.accessor("name", {
      header: "Category",
      size: 280,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {row.original.name}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {row.original.description || "No description"}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor("cluster_name", {
      header: "Cluster",
      size: 200,
      cell: ({ row }) => {
        const category = row.original;
        const Icon = CLUSTER_ICONS.find(
          (icon) => icon.value === category.cluster_icon,
        )?.icon;

        return (
          <div className="flex items-center gap-2.5">
            {Icon && (
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" />
            )}
            <span className="text-sm text-text-primary">
              {category.cluster_name}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor("business_count", {
      header: "Businesses",
      size: 130,
      meta: { skeleton: "number" },
      cell: (info) => (
        <span className="text-sm tabular-nums text-text-primary">
          {formatCount(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("application_count", {
      header: "Application References",
      size: 190,
      meta: { skeleton: "number" },
      cell: (info) => (
        <span className="text-sm tabular-nums text-text-primary">
          {formatCount(info.getValue())}
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
            aria-label={`Delete ${category.name}`}
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
              aria-label={`Edit ${category.name}`}
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
