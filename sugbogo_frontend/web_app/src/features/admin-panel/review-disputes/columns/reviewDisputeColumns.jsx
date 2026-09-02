import { createColumnHelper } from "@tanstack/react-table";
import { Eye, FileText, CalendarDays, Store, User } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/dateUtils";

const columnHelper = createColumnHelper();

/**
 * Creates the TanStack Table column definitions for review dispute management.
 *
 * Displays dispute reason, affected business, review author, status,
 * submission date, and the action used to inspect the dispute.
 */
export default function getReviewDisputeColumns(onViewDispute) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 60,
      meta: {
        skeleton: "number",
      },
      enableSorting: false,
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;

        return pageIndex * pageSize + row.index + 1;
      },
    }),

    columnHelper.accessor((dispute) => dispute.reason, {
      id: "reason",
      header: "Dispute",
      size: 240,
      minSize: 220,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const dispute = info.row.original;

        return (
          <div className="min-w-0">
            <p className="text-sm font-bold capitalize text-text-primary">
              {dispute.reason?.replaceAll("_", " ") || "—"}
            </p>

            <div className="mt-1 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-text-secondary" />

              <span className="text-xs text-text-secondary">
                Review #{dispute.review_id}
              </span>
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "business",
      header: "Business",
      size: 230,
      minSize: 200,
      meta: {
        skeleton: "longText",
      },
      cell: ({ row }) => {
        const dispute = row.original;

        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-secondary">
              <Store
                className="h-4 w-4 text-text-secondary"
                strokeWidth={1.75}
              />
            </div>

            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium text-text-primary"
                title={dispute.business_name || undefined}
              >
                {dispute.business_name || "—"}
              </p>

              <p className="mt-0.5 text-xs text-text-secondary">
                Business #{dispute.business_id}
              </p>
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "parties",
      header: "Submitted By",
      size: 220,
      minSize: 200,
      meta: {
        skeleton: "longText",
      },
      cell: ({ row }) => {
        const dispute = row.original;
        const merchant = dispute.merchant;
        const author = dispute.review_author;

        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-text-secondary" />

              <span className="truncate text-xs text-text-secondary">
                {merchant?.name || merchant?.email || "Merchant"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-text-secondary" />

              <span className="truncate text-xs text-text-secondary">
                {author?.name || author?.email || "Reviewer"}
              </span>
            </div>
          </div>
        );
      },
    }),

    columnHelper.accessor((dispute) => dispute.status, {
      id: "status",
      header: "Status",
      size: 140,
      meta: {
        skeleton: "text",
      },
      cell: (info) => {
        const status = info.getValue();

        const statusConfig = {
          pending: {
            label: "Pending",
            variant: "warning",
          },
          under_review: {
            label: "Under Review",
            variant: "info",
          },
          upheld: {
            label: "Upheld",
            variant: "success",
          },
          dismissed: {
            label: "Dismissed",
            variant: "danger",
          },
        };

        const config = statusConfig[status] ?? {
          label: status || "Unknown",
          variant: "default",
        };

        return (
          <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
        );
      },
    }),

    columnHelper.accessor((dispute) => dispute.created_at, {
      id: "created_at",
      header: "Submitted",
      size: 140,
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <div className="flex items-center gap-1.5">
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0 text-text-secondary"
            strokeWidth={1.75}
          />

          <span className="text-sm text-text-secondary">
            {formatDate(info.getValue())}
          </span>
        </div>
      ),
    }),

    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: {
        skeleton: "actions",
      },
      size: 90,
      enableSorting: false,
      cell: ({ row }) => {
        const dispute = row.original;

        return (
          <div className="flex items-center justify-center">
            <Button
              variant="action"
              size="md"
              icon={Eye}
              iconOnly
              tooltipMessage="Review dispute"
              onClick={() => onViewDispute(dispute)}
            />
          </div>
        );
      },
    }),
  ];
}
