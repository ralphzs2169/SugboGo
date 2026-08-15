import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import Button from "@/shared/components/Button";
import { formatDateTime } from "@/shared/utils/dateUtils";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

const columnHelper = createColumnHelper();

/**
 * Creates the TanStack Table column definitions for specialty tags.
 *
 * Includes:
 * - Row numbering based on the current pagination state
 * - Specialty tag name with its configured badge color
 * - Number of businesses using each specialty tag
 * - Created and updated timestamps
 * - Edit and delete actions
 */
export default function getSpecialtyTagColumns(
  onEditSpecialtyTag,
  onDeleteSpecialtyTag,
) {
  // Falls back to blue if the API returns an unknown or missing color.
  function getSpecialtyTagColorClasses(color) {
    return colorClasses[color] ?? colorClasses.blue;
  }

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

        // Calculate the row number across server-side paginated pages.
        return pageIndex * pageSize + row.index + 1;
      },
    }),

    columnHelper.accessor((tag) => tag.name, {
      id: "name",
      header: "Specialty Tag",
      size: 200,
      minSize: 150,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const tag = info.row.original;

        return <SpecialtyTagChip tag={tag} />;
      },
    }),

    columnHelper.accessor((tag) => tag.business_count, {
      id: "business_count",
      header: "Businesses",
      size: 120,
      meta: {
        skeleton: "number",
      },
      cell: (info) => (
        <span className="text-sm font-medium text-text-primary">
          {info.getValue() ?? 0}
        </span>
      ),
    }),

    columnHelper.accessor((tag) => tag.application_count, {
      id: "application_count",
      header: "Merchant Applications",
      size: 170,
      meta: {
        skeleton: "number",
      },
      cell: (info) => (
        <span className="text-sm font-medium text-text-primary">
          {info.getValue() ?? 0}
        </span>
      ),
    }),

    columnHelper.accessor((tag) => tag.created_at, {
      id: "created_at",
      header: "Created",
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),

    columnHelper.accessor((tag) => tag.updated_at, {
      id: "updated_at",
      header: "Last Updated",
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(info.getValue())}
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
        const specialtyTag = row.original;
        const hasApplications = specialtyTag.application_count > 0;

        return (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              iconOnly
              onClick={() => onEditSpecialtyTag(specialtyTag)}
            />

            {hasApplications ? (
              <Tooltip
                content="Cannot be deleted because this specialty tag is currently in use."
                place="top"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  iconOnly
                  disabled
                />
              </Tooltip>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                icon={Trash2}
                iconOnly
                onClick={() => onDeleteSpecialtyTag(specialtyTag)}
              />
            )}
          </div>
        );
      },
    }),
  ];
}
