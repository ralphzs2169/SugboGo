import { ArrowLeft } from "lucide-react";
import StickyContextBar from "@/shared/components/StickyContextBar";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatLabel } from "@/shared/utils/stringUtils";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import {
  USER_ROLE_BADGE_VARIANT,
  USER_STATUS_BADGE_VARIANT,
} from "../../constants/userManagement";

/** Keeps the selected user's identity visible after their profile scrolls away. */
export default function UserDetailContextBar({ user }) {
  const handleBack = useNavigateBack("/admin-panel/users/all");

  return (
    <StickyContextBar responsive ariaLabel="User context">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex w-full shrink-0 cursor-pointer items-center gap-2 text-sm font-medium transition-colors hover:text-text-primary sm:w-auto"
      >
        <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
        <span>Back to Users</span>
      </button>
      <div className="flex w-full min-w-0 items-center justify-end gap-3 sm:w-auto sm:flex-1">
        <UserAvatar
          avatarUrl={user.avatar_url}
          avatarKey={user.avatar_key}
          size="queue"
          className="hidden sm:block"
        />
        <div className="min-w-0 max-w-56 flex-1 text-right sm:flex-initial">
            <p className="min-w-0 truncate text-sm font-semibold text-text-primary" title={user.name}>
              {user.name}
            </p>
          <p className="mt-0.5 text-xs text-text-secondary">User #{user.id}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <StatusBadge variant={USER_ROLE_BADGE_VARIANT[user.role] || "neutral"} showDot={false}>
              {formatLabel(user.role)}
            </StatusBadge>
            <StatusBadge variant={USER_STATUS_BADGE_VARIANT[user.status] || "neutral"}>
              {formatLabel(user.status)}
            </StatusBadge>
        </div>
      </div>
    </StickyContextBar>
  );
}
