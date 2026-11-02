import { createColumnHelper } from "@tanstack/react-table";
import {
  MapPin,
  Image,
  CalendarDays,
} from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import BusinessRowActions from "../components/BusinessRowActions";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/dateUtils";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import { CLUSTER_ICONS } from "../../cluster-category/constants/clusterIcons";

const columnHelper = createColumnHelper();

/**
 * Creates the TanStack Table column definitions for business management.
 *
 * Displays business identity, location, classification,
 * ownership, status, creation date, and supported navigation.
 */
export default function getBusinessColumns(
  onViewBusiness,
  onManageStatus,
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
      size: 390,
      minSize: 340,

      meta: {
        skeleton: "longText",
      },
      cell: (info) => {
        const business = info.row.original;
        const photoUrl = business.cover_photo_url;

        return (
          <div className="flex items-center gap-3">
            {/* Business cover photo */}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${business.business_name} cover`}
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-secondary">
                <Image
                  className="h-5 w-5 text-text-secondary"
                  strokeWidth={1.75}
                />
              </div>
            )}

            {/* Business identity and address */}
            <div className="min-w-0">
              <p className="max-w-72 truncate text-sm font-bold text-text-primary" title={business.business_name}>
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
            <p className="max-w-52 truncate text-[13px] font-medium text-text-primary" title={business.category_name}>
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
      id: "owner",
      header: "Owner",
      size: 240,
      minSize: 200,
      meta: { skeleton: "longText" },
      enableSorting: false,
      cell: ({ row }) => {
        const owner = row.original.owner;

        return (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar avatarUrl={owner?.avatar_url} avatarKey={owner?.avatar_key} size="lg" />
            <div className="min-w-0 max-w-48">
              <p className="truncate text-sm font-medium text-text-primary" title={owner?.name}>
                {owner?.name || "Owner unavailable"}
              </p>
              <p className="mt-1 truncate text-xs text-text-secondary" title={owner?.email}>
                {owner?.email || "Email unavailable"}
              </p>
            </div>
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
        const statusInfo = getBusinessStatusConfig(status);

        return (
          <StatusBadge variant={statusInfo.variant}>
            {statusInfo.label}
          </StatusBadge>
        );
      },
    }),

    columnHelper.accessor((business) => business.created_at, {
      id: "created_at",
      header: "Date Added",
      size: 130,
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
      size: 150,
      enableSorting: false,
      cell: ({ row }) => {
        const business = row.original;

        return (
          <BusinessRowActions
            key={business.id}
            business={business}
            onViewBusiness={onViewBusiness}
            onManageStatus={onManageStatus}
          />
        );
      },
    }),
  ];
}
