import { createColumnHelper } from "@tanstack/react-table";
import { Eye, FileText, Ban, CheckCircle, MapPin, Image } from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/utils/dateUtils";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "../../cluster-category/constants/clusterIcons";
import ActionMenu from "@/features/admin-panel/components/ActionMenu";

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
 * Displays business identity, account ownership, classification,
 * specialty tags, location, status, creation date, and the detail action.
 */
export default function getBusinessColumns(onViewBusiness) {
  return [
    columnHelper.display({
      id: "rowNumber",
      header: "No.",
      size: 40,
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
      size: 250,
      minSize: 180,
      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const business = info.row.original;
        const photoUrl = business.storefront_photo?.url;

        return (
          <div className="flex items-center gap-3">
            {/* Business photo */}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${business.business_name} storefront`}
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

            {/* Business identity */}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">
                {business.business_name || "—"}
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 text-text-secondary" />

                <p
                  className="max-w-[220px] truncate text-xs text-text-secondary"
                  title={business.location || undefined}
                >
                  {business.location || "No location"}
                </p>
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <UserAvatar avatarUrl={business.owner?.avatar_url} size="sm" />

                <p className="truncate text-xs text-text-secondary">
                  {business.owner?.name || "Unknown owner"}
                </p>
              </div>
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "classification",
      header: "Classification",
      size: 230,
      minSize: 200,
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
            <p className="text-sm font-medium text-text-primary">
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

    columnHelper.display({
      id: "specialty_tags",
      header: "Specialty Tags",
      size: 180,
      minSize: 140,
      meta: {
        skeleton: "longText",
      },
      enableSorting: false,
      cell: ({ row }) => {
        const tags = row.original.specialty_tags ?? [];

        if (tags.length === 0) {
          return <span className="text-sm text-text-secondary">—</span>;
        }

        return (
          <div className="flex flex-col items-start gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <SpecialtyTagChip key={tag.id} tag={tag} />
            ))}

            {tags.length > 3 && (
              <span className="text-xs font-medium text-text-secondary">
                +{tags.length - 3} more
              </span>
            )}
          </div>
        );
      },
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
      size: 80,
      enableSorting: false,
      cell: ({ row }) => {
        const business = row.original;
        const isActive = business.status === "active";

        return (
          <ActionMenu
            items={[
              {
                key: "view",
                label: "View business",
                icon: Eye,
                onClick: () => onViewBusiness(business),
              },
              {
                key: "application",
                label: "View application",
                icon: FileText,
                onClick: () => onViewApplication(business),
              },
              {
                separator: true,
              },
              {
                key: "status",
                label: isActive ? "Suspend business" : "Activate business",
                icon: isActive ? Ban : CheckCircle,
                destructive: isActive,
                onClick: () => onToggleStatus(business),
              },
            ]}
          />
        );
      },
    }),
  ];
}
