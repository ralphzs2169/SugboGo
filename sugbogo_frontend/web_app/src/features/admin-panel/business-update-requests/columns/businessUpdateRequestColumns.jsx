import { createColumnHelper } from "@tanstack/react-table";
import {
  CalendarDays,
  Eye,
  FilePenLine,
  Image,
  MapPin,
  Shapes,
  Type,
} from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";

const columnHelper = createColumnHelper();

const REQUEST_TYPE_CONFIG = {
  business_name: {
    title: "Business Name",
    description: "Name update",
    icon: Type,
  },
  classification: {
    title: "Classification",
    description: "Category & specialties",
    icon: Shapes,
  },
  location: {
    title: "Location",
    description: "Address & landmarks",
    icon: MapPin,
  },
};

const FALLBACK_REQUEST_TYPE = {
  title: "Update Request",
  description: "Business update",
  icon: FilePenLine,
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});

function getSubmittedDateParts(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    iso: date.toISOString(),
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

/**
 * Builds the Admin business update request queue columns.
 *
 * Presents request types with compact visual identifiers, separates
 * submission dates from times, and adapts row actions to review status.
 */
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
        <div className="flex min-w-0 items-center gap-3">
          {/* Business cover */}
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
                aria-hidden="true"
              />
            </div>
          )}

          {/* Business identity */}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
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
      size: 230,
      meta: { skeleton: "longText" },
      enableSorting: false,
      cell: ({ row }) => {
        const config =
          REQUEST_TYPE_CONFIG[row.original.request_type] ??
          FALLBACK_REQUEST_TYPE;

        const Icon = config.icon;

        return (
          <div className="flex min-w-0 items-center gap-3">
            {/* Request type icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-text-secondary">
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            </div>

            {/* Request type label */}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {config.title}
              </p>

              <p className="mt-1 truncate text-xs text-text-secondary">
                {config.description}
              </p>
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "merchant",
      header: "Requested By",
      size: 220,
      meta: { skeleton: "longText" },
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          {/* Merchant avatar */}
          <UserAvatar
            avatarUrl={row.original.merchant?.avatar_url}
            avatarKey={row.original.merchant?.avatar_key}
            size="compact"
          />

          {/* Merchant identity */}
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
      size: 165,
      meta: { skeleton: "text" },
      enableSorting: false,
      cell: ({ row }) => {
        const submitted = getSubmittedDateParts(row.original.submitted_at);

        if (!submitted) {
          return <span className="text-sm text-text-secondary">—</span>;
        }

        return (
          <div className="flex items-start gap-2">
            {/* Submission date icon */}
            {/* <CalendarDays
              size={16}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-text-secondary"
              aria-hidden="true"
            /> */}

            {/* Date and time */}
            <time
              dateTime={submitted.iso}
              className="flex min-w-0 flex-col gap-0.5"
            >
              <span className="whitespace-nowrap text-sm font-medium text-text-primary">
                {submitted.date}
              </span>

              <span className="text-xs text-text-secondary">
                {submitted.time}
              </span>
            </time>
          </div>
        );
      },
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
      cell: ({ row }) => {
        const isPending = row.original.status === "pending";

        return (
          <Button
            variant="action"
            size="sm"
            icon={Eye}
            onClick={() => onView(row.original)}
          >
            {isPending ? "Review" : "View"}
          </Button>
        );
      },
    }),
  ];
}
