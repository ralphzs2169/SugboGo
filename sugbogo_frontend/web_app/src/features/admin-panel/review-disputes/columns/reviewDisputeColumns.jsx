import { createColumnHelper } from "@tanstack/react-table";
import { CalendarDays, Eye, Store } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/dateUtils";
import { formatLabel } from "@/shared/utils/stringUtils";
import UserAvatar from "@/shared/components/UserAvatar";
import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../constants/reviewDisputeStatus";

const columnHelper = createColumnHelper();

/**
 * Creates the TanStack Table columns for the review dispute moderation queue,
 * surfacing case identity, business context, submitter, status, and queue state.
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
      size: 250,
      minSize: 220,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const dispute = info.row.original;

        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {formatLabel(dispute.reason) || "—"}
            </p>

            <p className="mt-1 text-xs text-text-secondary">
              Dispute #{dispute.id} · Review #{dispute.review_id}
            </p>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "business",
      header: "Business",
      size: 240,
      minSize: 210,
      meta: {
        skeleton: "longText",
      },
      cell: ({ row }) => {
        const dispute = row.original;

        return (
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Business thumbnail */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stroke bg-surface-secondary">
              {dispute.business_cover_photo_url ? (
                <img
                  src={dispute.business_cover_photo_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Store
                  className="h-4 w-4 text-text-secondary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Business identity */}
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
      id: "submittedBy",
      header: "Submitted By",
      size: 220,
      minSize: 190,
      meta: {
        skeleton: "longText",
      },
      cell: ({ row }) => {
        const merchant = row.original.merchant;

        return (
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Merchant avatar */}
            <UserAvatar avatarUrl={merchant?.avatar_url} size="lg" />

            {/* Merchant identity */}
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium text-text-primary"
                title={merchant?.name || merchant?.email || undefined}
              >
                {merchant?.name || merchant?.email || "—"}
              </p>

              <p className="mt-0.5 text-xs text-text-secondary">Merchant</p>
            </div>
          </div>
        );
      },
    }),

    columnHelper.accessor((dispute) => dispute.status, {
      id: "status",
      header: "Status",
      size: 130,
      meta: {
        skeleton: "text",
      },
      cell: (info) => {
        const status = info.getValue();

        return (
          <StatusBadge
            variant={REVIEW_DISPUTE_STATUS_BADGE_VARIANT[status] || "neutral"}
          >
            {formatLabel(status)}
          </StatusBadge>
        );
      },
    }),

    columnHelper.accessor((dispute) => dispute.created_at, {
      id: "created_at",
      header: "Submitted",
      size: 150,
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <div className="flex items-center gap-1.5">
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <span className="text-sm text-text-secondary">
            {formatDate(info.getValue())}
          </span>
        </div>
      ),
    }),

    columnHelper.display({
      id: "queue",
      header: "Queue",
      size: 120,
      meta: {
        skeleton: "text",
      },
      enableSorting: false,
      cell: () => <span className="text-sm text-text-secondary">—</span>,
    }),

    columnHelper.display({
      id: "actions",
      header: "Actions",
      size: 90,
      meta: {
        skeleton: "actions",
      },
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
