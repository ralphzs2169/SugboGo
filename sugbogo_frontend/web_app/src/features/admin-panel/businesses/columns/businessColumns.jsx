import { createColumnHelper } from "@tanstack/react-table";
import {
  Eye,
  FileText,
  Ban,
  CheckCircle,
  MapPin,
  Image,
  Heart,
  MessageCircle,
} from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/dateUtils";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "../../cluster-category/constants/clusterIcons";

const columnHelper = createColumnHelper();

const STATUS_CONFIG = {
  active: {
    label: "Active",
    variant: "success",
  },
  suspended: {
    label: "Suspended",
    variant: "warning",
  },
};

/**
 * Creates the TanStack Table column definitions for business management.
 *
 * Displays business identity, location, specialty tags, classification,
 * community activity, status, creation date, and management actions.
 */
export default function getBusinessColumns(
  onViewBusiness,
  onViewApplication,
  onToggleStatus,
) {
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

    columnHelper.accessor((business) => business.business_name, {
      id: "business_name",
      header: "Business",
      size: 320,
      minSize: 280,

      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const business = info.row.original;
        const photoUrl = business.cover_photo_url;
        const tags = business.specialty_tags ?? [];

        return (
          <div className="flex items-center gap-3">
            {/* Business cover photo */}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${business.business_name} cover`}
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

            {/* Business identity and specialty tags */}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">
                {business.business_name || "—"}
              </p>

              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {tags.slice(0, 3).map((tag) => (
                    <SpecialtyTagChip key={tag.id} tag={tag} size="small" />
                  ))}

                  {tags.length > 3 && (
                    <span className="ml-0.5 text-[10px] font-medium text-text-secondary">
                      +{tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* <div className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 text-text-secondary" />

                <p
                  className="max-w-[220px] truncate text-xs text-text-secondary"
                  title={business.location || undefined}
                >
                  {business.location || "No location"}
                </p>
              </div> */}
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "classification",
      header: "Classification",
      size: 250,
      minSize: 220,
      meta: {
        skeleton: "longText",
      },
      cell: ({ row }) => {
        const business = row.original;

        const clusterIcon = CLUSTER_ICONS.find(
          (icon) => icon.value === business.cluster_icon,
        );

        const Icon = clusterIcon?.icon;

        return (
          <div>
            <p className="text-[13px] font-medium text-text-primary">
              {business.category_name || "—"}
            </p>

            <div className="mt-1 flex items-center gap-2">
              {Icon && (
                <span className="flex shrink-0 items-center justify-center text-text-secondary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              )}

              <p className="truncate text-xs text-text-secondary">
                {business.cluster_name || "—"}
              </p>
            </div>
          </div>
        );
      },
    }),

    // Community activity will be populated once the backend
    // starts returning the corresponding business-level metrics.
    columnHelper.display({
      id: "community_activity",
      header: "Community Activity",
      size: 180,
      minSize: 160,
      meta: {
        skeleton: "longText",
      },
      enableSorting: false,
      cell: () => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">
              — total vouches
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-text-secondary" />
            <span className="text-xs text-text-secondary">— reviews</span>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor((business) => business.status, {
      id: "status",
      header: "Status",
      size: 130,
      meta: {
        skeleton: "text",
      },
      cell: (info) => {
        const status = info.getValue();
        const statusInfo = STATUS_CONFIG[status];

        return (
          <StatusBadge variant={statusInfo?.variant ?? "neutral"}>
            {statusInfo?.label ?? status ?? "—"}
          </StatusBadge>
        );
      },
    }),

    columnHelper.accessor((business) => business.created_at, {
      id: "created_at",
      header: "Created",
      size: 120,
      meta: {
        skeleton: "text",
      },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDate(info.getValue())}
        </span>
      ),
    }),

    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: {
        skeleton: "actions",
      },
      size: 150,
      enableSorting: false,
      cell: ({ row }) => {
        const business = row.original;
        const isActive = business.status === "active";

        return (
          <div className="flex items-center justify-center">
            <Button
              variant="action"
              size="md"
              icon={Eye}
              iconOnly
              tooltipMessage="View business"
              onClick={() => onViewBusiness(business)}
            />

            <Button
              variant="action"
              size="md"
              icon={FileText}
              iconOnly
              tooltipMessage="View application"
              onClick={() => onViewApplication(business)}
            />

            <Button
              variant="action"
              size="md"
              icon={isActive ? Ban : CheckCircle}
              iconOnly
              tooltipMessage={
                isActive ? "Suspend business" : "Activate business"
              }
              onClick={() => onToggleStatus(business)}
            />
          </div>
        );
      },
    }),
  ];
}
