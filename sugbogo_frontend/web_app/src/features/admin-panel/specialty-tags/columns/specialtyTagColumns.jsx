import { createColumnHelper } from "@tanstack/react-table";
import Button from "@/shared/components/Button";
import { Pencil, Trash2 } from "lucide-react";
import { formatDateTime } from "@/shared/utils/dateUtils";

const columnHelper = createColumnHelper();

export default function getSpecialtyTagColumns(
  onEditSpecialtyTag,
  onDeleteSpecialtyTag,
) {
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

        return pageIndex * pageSize + row.index + 1;
      },
    }),

    columnHelper.accessor((tag) => tag.name, {
      id: "name",
      header: "Specialty Tag",
      size: 300,
      minSize: 200,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => (
        <span className="text-sm font-medium text-text-primary">
          {info.getValue()}
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

        return (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              iconOnly
              onClick={() => onEditSpecialtyTag(specialtyTag)}
            />

            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              iconOnly
              onClick={() => onDeleteSpecialtyTag(specialtyTag)}
            />
          </div>
        );
      },
    }),
  ];
}
