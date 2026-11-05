import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import Button from "@/shared/components/Button";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { formatCount } from "@/features/admin-panel/analytics/utils/presentation";

const columnHelper = createColumnHelper();

/** Show active assignment usage while retaining the configured chip and CRUD actions. */
export default function getSpecialtyTagColumns(
  onEditSpecialtyTag,
  onDeleteSpecialtyTag,
) {
  return [
    columnHelper.accessor("name", {
      header: "Specialty Tag",
      size: 280,
      meta: { skeleton: "longText" },
      cell: ({ row }) => <SpecialtyTagChip tag={row.original} showIcon />,
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
