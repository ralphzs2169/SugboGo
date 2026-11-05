import { CheckCircle2, Mail, UserRound, XCircle } from "lucide-react";
import UserDetailHeading from "./UserDetailHeading";

import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatLabel } from "@/shared/utils/stringUtils";

import {
  USER_ROLE_BADGE_VARIANT,
  USER_STATUS_BADGE_VARIANT,
} from "../../constants/userManagement";
import {
  formatUserDateTime,
  formatUserJoinedDate,
  formatUserJoinedTime,
  formatUserReputation,
} from "../../utils/userPresentation";

export default function UserAccountInformation({ user, profileRef }) {
  const details = [
    { label: "Email", value: user.email },
    {
      label: "Date Joined",
      value: formatUserJoinedDate(user.joined_at),
      description: user.joined_at
        ? `${formatUserJoinedTime(user.joined_at)} · PHT`
        : null,
    },
  ];

  if (["explorer", "merchant"].includes(user.role)) {
    details.push({
      label: "Reputation Score",
      value: formatUserReputation(user.reputation),
      description: "0–1 scale. Changes through contribution rewards and confirmed-violation penalties.",
    });
  }

  return (
    <section ref={profileRef} aria-label="Account information" className="min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5">
      <UserDetailHeading icon={UserRound} title="Account Information" />

      <div className="min-w-0">
        <div className="flex flex-col items-center gap-3 border-b border-stroke py-5 text-center">
          <UserAvatar
            avatarUrl={user.avatar_url}
            avatarKey={user.avatar_key}
            size="profile"
          />
          <div className="min-w-0">
            <h3 className="break-words text-xl font-semibold leading-tight text-text-primary [overflow-wrap:anywhere]">
              {user.name}
            </h3>
            <p className="mt-2 text-xs text-text-secondary">
              User #{user.id}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <StatusBadge variant={USER_ROLE_BADGE_VARIANT[user.role] || "neutral"} showDot={false}>
                {formatLabel(user.role)}
              </StatusBadge>
              <StatusBadge
                variant={USER_STATUS_BADGE_VARIANT[user.status] || "neutral"}
              >
                {formatLabel(user.status)}
              </StatusBadge>
            </div>
          </div>
        </div>

        <dl className="divide-y divide-stroke">
          {details.map((detail) => (
            <div key={detail.label} className="min-w-0 py-4 last:pb-0">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                {detail.label === "Email" && (
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {detail.label}
              </dt>
              <dd className="mt-1 min-w-0 text-sm font-medium text-text-primary [overflow-wrap:anywhere]">
                {detail.value}
              </dd>
              {detail.label === "Email" && (
                <dd className="mt-2 space-y-1">
                  <div className={`flex items-center gap-1.5 text-xs ${user.email_verified ? "text-success" : "text-text-secondary"}`}>
                    {user.email_verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{user.email_verified ? "Email verified" : "Email not verified"}</span>
                  </div>
                  {user.email_verified && user.email_verified_at && (
                    <p className="text-xs leading-5 text-text-secondary">
                      Verified {formatUserDateTime(user.email_verified_at)}
                    </p>
                  )}
                </dd>
              )}
              {detail.description && (
                <dd className="mt-1 text-xs leading-5 text-text-secondary">
                  {detail.description}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
