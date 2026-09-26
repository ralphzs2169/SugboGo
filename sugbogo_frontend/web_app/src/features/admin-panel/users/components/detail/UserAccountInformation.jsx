import { CheckCircle2, Mail, ShieldCheck, XCircle } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatDate } from "@/shared/utils/dateUtils";
import { formatLabel } from "@/shared/utils/stringUtils";

import { USER_STATUS_BADGE_VARIANT } from "../../constants/userManagement";

export default function UserAccountInformation({ user }) {
  const details = [
    { label: "Email", value: user.email },
    { label: "Role", value: formatLabel(user.role) },
    { label: "Joined", value: formatDate(user.joined_at) },
    { label: "Reputation", value: user.reputation ?? "—" },
  ];

  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Account Information
      </h2>

      <div className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="flex flex-col gap-5 border-b border-stroke p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar
              avatarUrl={user.avatar_url}
              avatarKey={user.avatar_key}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-xl font-bold text-text-primary">
                  {user.name}
                </h3>
                <StatusBadge
                  variant={USER_STATUS_BADGE_VARIANT[user.status] || "neutral"}
                >
                  {formatLabel(user.status)}
                </StatusBadge>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                User #{user.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-stroke bg-surface px-3 py-2">
            {user.email_verified ? (
              <CheckCircle2
                className="h-4 w-4 text-success"
                aria-hidden="true"
              />
            ) : (
              <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold text-text-primary">
              {user.email_verified ? "Email verified" : "Email not verified"}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-px bg-stroke sm:grid-cols-2 lg:grid-cols-4">
          {details.map((detail) => (
            <div key={detail.label} className="bg-background p-5">
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {detail.label === "Email" && (
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {detail.label === "Role" && (
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {detail.label}
              </dt>
              <dd className="mt-2 break-words text-sm font-medium text-text-primary">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
