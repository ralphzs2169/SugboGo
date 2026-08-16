import { Eye } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import UserAvatar from "@/shared/components/UserAvatar";
import Button from "@/shared/components/Button";
import { formatDate } from "@/shared/utils/dateUtils";
import StatusBadge from "../../../../shared/components/StatusBadge";
import statusConfig from "../config/applicationStatus.config";
import ApplicationQueueStatus from "../components/ApplicationQueueStatus";
import { CLUSTER_ICONS } from "../../cluster-category/constants/clusterIcons";

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

    columnHelper.display({
      id: "classification",
      header: "Classification",
      size: 240,
      minSize: 200,
      meta: {
        skeleton: "longText",
      },
      cell: ({ row }) => {
        const application = row.original;

        const clusterIcon = CLUSTER_ICONS.find(
          (icon) => icon.value === application.cluster_icon,
        );

        const Icon = clusterIcon?.icon;

        return (
          <div>
            <p className="text-sm font-medium text-text-primary">
              {application.category_name || "—"}
            </p>

            <div className="mt-1 flex items-center gap-2">
              {Icon && (
                <span className="flex shrink-0 items-center justify-center text-text-secondary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              )}

              <p className="truncate text-xs text-text-secondary">
                {application.cluster_name || "—"}
              </p>
            </div>
          </div>
        );
      },
    }),

    columnHelper.accessor((application) => application.status, {
      id: "status",
      header: "Status",
      size: 150,
      meta: {
        skeleton: "text",
      },
      cell: (info) => {
        const application = info.row.original;
        const status = info.getValue();
        const statusInfo = statusConfig[status];

        return (
          <div className="space-y-1">
            <StatusBadge variant={statusInfo?.variant ?? "neutral"}>
              {statusInfo?.label ?? status ?? "—"}
            </StatusBadge>

            {application.submission_count >= 2 && (
              <p className="text-xs font-medium text-text-secondary">
                Resubmission #{application.submission_count - 1}
              </p>
            )}
          </div>
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
          {formatDate(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor(
      (application) => application.time_in_queue_business_days,
      {
        id: "time_in_queue_business_days",
        header: "Time in Queue",
        size: 170,
        minSize: 150,
        meta: {
          skeleton: "text",
        },
        enableSorting: false,
        cell: ({ row }) => {
          const application = row.original;

          return (
            <ApplicationQueueStatus
              submittedAt={application.submitted_at}
              resolvedAt={application.reviewed_at}
              days={application.time_in_queue_business_days}
              status={application.queue_status}
            />
          );
        },
      },
    ),
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
