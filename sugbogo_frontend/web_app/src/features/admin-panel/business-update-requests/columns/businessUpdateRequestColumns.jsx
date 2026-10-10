import { createColumnHelper } from "@tanstack/react-table";
import { CalendarDays, Eye, Image } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatDateTime } from "@/shared/utils/dateUtils";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";

const columnHelper = createColumnHelper();

const REQUEST_TYPE_LABELS = {
  business_name: "Business Name Change",
  classification: "Classification & Specialties Change",
  location: "Location & Landmarks Change",
};

/** Builds the compact Admin queue columns for the selected update-request type. */
export default function businessUpdateRequestColumns(onView) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 50,
      meta: { skeleton: "number" },
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return pageIndex * pageSize + row.index + 1;
      },
    }),
    columnHelper.display({
      id: "business",
      header: "Business",
      size: 260,
      meta: { skeleton: "longText" },
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.cover_photo_url ? (
            <img
              src={row.original.cover_photo_url}
              alt={`${row.original.current_business_name} cover`}
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-secondary">
              <Image
                className="h-5 w-5 text-text-secondary"
                strokeWidth={1.75}
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text-primary">
              {row.original.current_business_name || "—"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Business #{row.original.business_id}
            </p>
          </div>
        </div>
      ),
    }),
    columnHelper.display({
      id: "requestType",
      header: "Request Type",
      size: 190,
      meta: { skeleton: "longText" },
      enableSorting: false,
      cell: ({ row }) => (
        <p className="text-sm font-medium text-text-primary">
          {REQUEST_TYPE_LABELS[row.original.request_type] || "Update Request"}
        </p>
      ),
    }),
    columnHelper.display({
      id: "merchant",
      header: "Requested By",
      size: 220,
      meta: { skeleton: "longText" },
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar
            avatarUrl={row.original.merchant?.avatar_url}
            avatarKey={row.original.merchant?.avatar_key}
            size="compact"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {row.original.merchant?.name ||
                row.original.merchant?.email ||
                "—"}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {row.original.merchant?.email}
            </p>
          </div>
        </div>
      ),
    }),
    columnHelper.display({
      id: "submitted",
      header: "Submitted",
      size: 180,
      meta: { skeleton: "text" },
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0 text-text-secondary"
            strokeWidth={1.75}
          />
          <span className="text-sm text-text-secondary">
            {formatDateTime(row.original.submitted_at)}
          </span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "status",
      header: "Status",
      size: 130,
      meta: { skeleton: "text" },
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge
          variant={UPDATE_REQUEST_STATUS_VARIANTS[row.original.status]}
        >
          {row.original.status.charAt(0).toUpperCase() +
            row.original.status.slice(1)}
        </StatusBadge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Action",
      size: 110,
      meta: { skeleton: "actions" },
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="action"
          size="sm"
          icon={Eye}
          onClick={() => onView(row.original)}
        >
          Review
        </Button>
      ),
    }),
  ];
}
