import { Eye } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import UserAvatar from "@/shared/components/UserAvatar";
import Button from "@/shared/components/Button";
import { formatDateTime } from "@/shared/utils/dateUtils";
import StatusBadge from "../../../../shared/components/StatusBadge";
import statusConfig from "../config/applicationStatus.config";

const columnHelper = createColumnHelper();

/**
 * Creates the TanStack Table column definitions for business applications.
 *
 * Includes the paginated row number, business information, application
 * status, submission timestamp, and the action used to open an application
 * for review.
 */
export default function getBusinessApplicationColumns(onReviewApplication) {
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

    columnHelper.accessor((application) => application.business_name, {
      id: "business_name",
      header: "Business",
      size: 250,
      minSize: 180,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const application = info.row.original;

        return (
          <div>
            <p className="text-sm font-bold text-text-primary">
              {info.getValue() || "—"}
            </p>

            <div className="mt-1 flex items-center gap-2">
              <UserAvatar
                avatarUrl={application.submitter?.avatar_url}
                size="sm"
              />

              <p className="text-xs text-text-secondary">
                by {application.submitter?.name || "Unknown submitter"}
              </p>
            </div>
          </div>
        );
      },
    }),

    columnHelper.accessor((application) => application.cluster_name, {
      id: "cluster_name",
      header: "Cluster",
      size: 180,
      minSize: 140,
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <span className="text-sm text-text-primary">
          {info.getValue() || "—"}
        </span>
      ),
    }),

    columnHelper.accessor((application) => application.category_name, {
      id: "category_name",
      header: "Category",
      size: 240,
      minSize: 180,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => (
        <span className="text-sm text-text-primary">
          {info.getValue() || "—"}
        </span>
      ),
    }),

    columnHelper.accessor((application) => application.status, {
      id: "status",
      header: "Status",
      size: 150,
      meta: {
        skeleton: "text",
      },
      cell: (info) => {
        const status = info.getValue();
        const statusInfo = statusConfig[status];

        return (
          <StatusBadge variant={statusInfo?.variant ?? "neutral"}>
            {statusInfo?.label ?? status ?? "—"}
          </StatusBadge>
        );
      },
    }),

    columnHelper.accessor((application) => application.submitted_at, {
      id: "submitted_at",
      header: "Submitted",
      size: 180,
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
      size: 100,
      enableSorting: false,
      cell: ({ row }) => {
        const application = row.original;

        return (
          <div className="flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              iconOnly
              tooltipMessage="Review application"
              onClick={() => onReviewApplication(application)}
            />
          </div>
        );
      },
    }),
  ];
}
