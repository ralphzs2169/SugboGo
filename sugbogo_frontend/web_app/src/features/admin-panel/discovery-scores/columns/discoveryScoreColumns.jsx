import { createColumnHelper } from "@tanstack/react-table";
import { Eye, Image } from "lucide-react";
import Button from "@/shared/components/Button";
import RefreshStatusBadge from "../components/RefreshStatusBadge";
import { formatScore } from "../utils/presentation";

const columnHelper = createColumnHelper();
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});

/** Use supported server orderings and the established management table cells. */
export default function getDiscoveryScoreColumns(onViewDetails) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 55,
      enableSorting: false,
      meta: { skeleton: "number" },
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return pageIndex * pageSize + row.index + 1;
      },
    }),
    columnHelper.accessor((row) => row.business?.business_name, {
      id: "business_name",
      header: "Business",
      size: 310,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const business = row.original.business;
        if (!business) return "—";
        const classification = [business.category_name, business.cluster_name].filter(Boolean).join(" · ");
        return (
          <div className="flex min-w-0 items-center gap-3">
            {business.cover_photo_url ? (
              <img
                src={business.cover_photo_url}
                alt={`${business.business_name} cover`}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-secondary">
                <Image aria-hidden="true" className="h-5 w-5 text-text-secondary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary" title={business.business_name}>
                {business.business_name || "—"}
              </p>
              <p className="mt-1 truncate text-xs text-text-secondary" title={classification}>
                {classification || "Classification unavailable"}
              </p>
            </div>
          </div>
        );
      },
    }),
    ...[
      ["specialty_score", "Specialty Score"],
      ["visibility_gap", "Visibility Gap"],
      ["discovery_score", "Discovery Score"],
    ].map(([field, header]) => columnHelper.accessor(field, {
      header,
      size: 140,
      meta: { skeleton: "number" },
      cell: (info) => (
        <span className={`text-sm tabular-nums text-text-primary ${field === "discovery_score" ? "font-bold" : "font-medium"}`}>
          {formatScore(info.getValue())}
        </span>
      ),
    })),
    columnHelper.accessor("refresh_status", {
      header: "Refresh Status",
      size: 145,
      enableSorting: false,
      meta: { skeleton: "badge" },
      cell: (info) => <RefreshStatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor("computed_at", {
      header: "Last Computed",
      size: 190,
      meta: { skeleton: "text" },
      cell: (info) => {
        const value = info.getValue();
        const date = value ? new Date(value) : null;

        if (!date || Number.isNaN(date.getTime())) {
          return <span className="text-sm text-text-secondary">—</span>;
        }

        return (
          <time
            dateTime={date.toISOString()}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <span className="whitespace-nowrap text-sm font-medium text-text-primary">
              {dateFormatter.format(date)}
            </span>
            <span className="text-xs text-text-secondary">
              {timeFormatter.format(date)}
            </span>
          </time>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      size: 85,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="action"
          size="md"
          icon={Eye}
          iconOnly
          aria-label={`View Details for ${row.original.business?.business_name || "business"}`}
          tooltipMessage="View Details"
          onClick={() => onViewDetails(row.original.business)}
        />
      ),
    }),
  ];
}
