import { createColumnHelper } from "@tanstack/react-table";
import { CalendarDays, Eye, UserCheck, UserX } from "lucide-react";

import ActionMenu from "@/features/admin-panel/components/ActionMenu";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatDate } from "@/shared/utils/dateUtils";
import { formatLabel } from "@/shared/utils/stringUtils";

import {
  canManageUserStatus,
  USER_STATUS_BADGE_VARIANT,
} from "../constants/userManagement";

const columnHelper = createColumnHelper();

export default function getUserColumns({
  currentUser,
  onViewUser,
  onSuspendUser,
  onReactivateUser,
}) {
  return [
    columnHelper.accessor((user) => user.name, {
      id: "name",
      header: "User",
      size: 260,
      minSize: 220,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              avatarUrl={user.avatar_url}
              avatarKey={user.avatar_key}
              size="lg"
            />
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold text-text-primary"
                title={user.name || undefined}
              >
                {user.name || "Unknown user"}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                User #{user.id}
              </p>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor((user) => user.email, {
      id: "email",
      header: "Email",
      size: 250,
      minSize: 210,
      meta: { skeleton: "longText" },
      cell: (info) => (
        <span
          className="block truncate text-sm text-text-secondary"
          title={info.getValue()}
        >
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor((user) => user.role, {
      id: "role",
      header: "Role",
      size: 130,
      meta: { skeleton: "text" },
      cell: (info) => (
        <span className="text-sm font-medium text-text-primary">
          {formatLabel(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor((user) => user.status, {
      id: "status",
      header: "Status",
      size: 140,
      meta: { skeleton: "text" },
      cell: (info) => (
        <StatusBadge
          variant={USER_STATUS_BADGE_VARIANT[info.getValue()] || "neutral"}
        >
          {formatLabel(info.getValue())}
        </StatusBadge>
      ),
    }),
    columnHelper.accessor((user) => user.joined_at, {
      id: "joined_at",
      header: "Joined",
      size: 160,
      meta: { skeleton: "text" },
      cell: (info) => (
        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>{formatDate(info.getValue())}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      size: 90,
      enableSorting: false,
      meta: { skeleton: "actions" },
      cell: ({ row }) => {
        const user = row.original;
        const canManage = canManageUserStatus(currentUser, user);
        const items = [
          {
            key: "view",
            label: "View Profile",
            icon: Eye,
            onClick: () => onViewUser(user),
          },
        ];

        if (canManage && user.status === "active") {
          items.push({
            separator: true,
          });
          items.push({
            key: "suspend",
            label: "Suspend User",
            icon: UserX,
            destructive: true,
            onClick: () => onSuspendUser(user),
          });
        }

        if (canManage && user.status === "suspended") {
          items.push({
            separator: true,
          });
          items.push({
            key: "reactivate",
            label: "Reactivate User",
            icon: UserCheck,
            onClick: () => onReactivateUser(user),
          });
        }

        return <ActionMenu items={items} label={`Actions for ${user.name}`} />;
      },
    }),
  ];
}
