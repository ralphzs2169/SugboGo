import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import Button from "@/shared/components/Button";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { formatCount } from "@/features/admin-panel/analytics/utils/presentation";
import DateAddedCell from "../../components/data-table/DateAddedCell";

const columnHelper = createColumnHelper();

/** Show active assignment usage while retaining the configured chip and CRUD actions. */
export default function getSpecialtyTagColumns(
  onEditSpecialtyTag,
  onDeleteSpecialtyTag,
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
      header: "Specialty Tag",
      size: 180,
      meta: { skeleton: "longText" },
      cell: ({ row }) => <SpecialtyTagChip tag={row.original} showIcon />,
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
    columnHelper.accessor("application_count", {
      header: "Application References",
      size: 200,
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
        const specialtyTag = row.original;
        const hasApplications = specialtyTag.application_count > 0;

        return (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              iconOnly
              aria-label={`Edit ${specialtyTag.name}`}
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
                  aria-label={`Delete ${specialtyTag.name}`}
                  disabled
                />
              </Tooltip>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                icon={Trash2}
                iconOnly
                aria-label={`Delete ${specialtyTag.name}`}
                onClick={() => onDeleteSpecialtyTag(specialtyTag)}
              />
            )}
          </div>
        );
      },
    }),
  ];
}
