import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import StatusBadge from "@/shared/components/StatusBadge";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import BusinessLocationPreview from "./BusinessLocationPreview";
import BusinessHoursPreview from "./BusinessHoursPreview";
import BusinessContactPreview from "./BusinessContactPreview";
import UserAvatar from "@/shared/components/UserAvatar";
import BusinessImage from "./BusinessImage";
import BusinessDescription from "./BusinessDescription";

/**
 * Displays the primary identity of a permanent business.
 *
 * Combines the cover photo, linked owner account, classification,
 * specialty tags, description, compact location preview, operating
 * hours, contact info, and business status.
 */
export default function BusinessDetailHero({
  business,
  onOpenLocation,
  actions,
  statusInfo,
}) {
  const owner = business.owner;
  const status = getBusinessStatusConfig(business.status);

  const currentReason =
    business.status === "suspended" &&
    statusInfo?.data?.status === "suspended" &&
    !statusInfo.error &&
    !statusInfo.isFetching
      ? statusInfo.data.suspension_reason
      : null;

  return (
    <section>
      {/* Business profile */}
      <div className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
          {/* Business photos and owner */}
          <div className="min-w-0 p-4 sm:p-5 lg:pr-0">
            {/* Cover photo */}
            <BusinessImage
              src={business.cover_photo_url}
              alt={`${business.business_name} listing image`}
              loading="eager"
              fallback="Business image unavailable"
              className="aspect-[4/3] w-full rounded-xl"
            />

            {/* Linked SugboGo account */}
            <div className="mt-3 rounded-xl border border-stroke bg-surface-muted/40 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Linked Merchant Account
                </p>
              </div>

              <div className="mt-2.5 flex items-center gap-3">
                <UserAvatar
                  avatarUrl={owner?.avatar_url}
                  avatarKey={owner?.avatar_key}
                  size="lg"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {owner?.name || "Unknown account"}
                  </p>

                  {owner?.email && (
                    <p
                      className="mt-1 truncate text-xs text-text-secondary"
                      title={owner.email}
                    >
                      {owner.email}
                    </p>
                  )}
                </div>
              </div>
              {owner?.status && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span>Account status</span>
                  <StatusBadge
                    variant={
                      {
                        active: "successSoft",
                        pending: "warningSoft",
                        suspended: "dangerSoft",
                        disabled: "mutedSoft",
                      }[owner.status] || "mutedSoft"
                    }
                  >
                    {owner.status.charAt(0).toUpperCase() +
                      owner.status.slice(1)}
                  </StatusBadge>
                </div>
              )}
              {owner?.id != null ? (
                <Link
                  to={`/admin-panel/users/${owner.id}`}
                  className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-stroke bg-background px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-info"
                >
                  <span>View account</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <p className="mt-3 text-xs text-text-secondary">
                  Account link unavailable
                </p>
              )}
            </div>
          </div>

          {/* Business identity */}
          <div className="flex min-w-0 flex-col p-4 sm:p-5 lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="min-w-0 text-2xl font-bold leading-tight text-text-primary [overflow-wrap:anywhere]">
                    {business.business_name}
                  </h1>

                  <StatusBadge variant={status.variant}>
                    {status.label}
                  </StatusBadge>
                </div>

                <p className="mt-1 text-xs text-text-secondary">
                  Business ID #{business.id}
                </p>
              </div>

              {/* Business actions */}
              <div className="shrink-0">{actions}</div>
            </div>

            {/* Current merchant-facing suspension context */}
            {currentReason && (
              <div
                className="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm"
                role="note"
              >
                <h2 className="font-semibold text-text-primary">
                  Business suspended
                </h2>
                <p className="mt-1 text-text-secondary">
                  This listing is currently unavailable to explorers.
                </p>
                <p className="mt-3 font-semibold text-text-primary">Reason</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-text-secondary">
                  {currentReason}
                </p>
              </div>
            )}
            {statusInfo?.error && (
              <div className="mt-4 text-sm text-text-secondary" role="status">
                Current status context could not be refreshed.
                <button
                  type="button"
                  onClick={() => statusInfo.refetch()}
                  className="ml-2 cursor-pointer font-semibold text-primary hover:underline"
                >
                  Retry status
                </button>
              </div>
            )}

            {/* Classification */}
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
              <ClusterDisplay
                clusterName={business.cluster_name}
                clusterIcon={business.cluster_icon}
              />

              <span className="text-sm text-text-secondary">·</span>

              <span className="text-sm text-text-primary">
                {business.category_name || "No category"}
              </span>
            </div>

            {/* Specialty tags */}
            {business.specialty_tags?.length > 0 && (
              <div
                className={[
                  "mt-3 flex flex-wrap gap-2",
                  "[&>span]:max-w-full [&>span]:[overflow-wrap:anywhere] [&>span]:border",
                  "[&>span.bg-blue-500]:bg-blue-500/10 [&>span.bg-blue-500]:border-blue-500/25 [&>span.bg-blue-500]:text-blue-700 dark:[&>span.bg-blue-500]:text-blue-300",
                  "[&>span.bg-green-600]:bg-green-600/10 [&>span.bg-green-600]:border-green-600/25 [&>span.bg-green-600]:text-green-700 dark:[&>span.bg-green-600]:text-green-300",
                  "[&>span.bg-purple-600]:bg-purple-600/10 [&>span.bg-purple-600]:border-purple-600/25 [&>span.bg-purple-600]:text-purple-700 dark:[&>span.bg-purple-600]:text-purple-300",
                  "[&>span.bg-yellow-500]:bg-yellow-500/10 [&>span.bg-yellow-500]:border-yellow-500/25 [&>span.bg-yellow-500]:text-yellow-800 dark:[&>span.bg-yellow-500]:text-yellow-300",
                  "[&>span.bg-rose-600]:bg-rose-600/10 [&>span.bg-rose-600]:border-rose-600/25 [&>span.bg-rose-600]:text-rose-700 dark:[&>span.bg-rose-600]:text-rose-300",
                  "[&>span.bg-teal-700]:bg-teal-700/10 [&>span.bg-teal-700]:border-teal-700/25 [&>span.bg-teal-700]:text-teal-700 dark:[&>span.bg-teal-700]:text-teal-300",
                ].join(" ")}
              >
                {business.specialty_tags.map((tag) => (
                  <SpecialtyTagChip key={tag.id} tag={tag} showIcon />
                ))}
              </div>
            )}

            {/* About this place */}
            <BusinessDescription description={business.description} />

            {/* Location, hours & contact */}
            <div className="mt-4 grid min-w-0 grid-cols-1 items-stretch gap-5 border-t border-stroke pt-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3 xl:gap-4 xl:[&>*+*]:border-l xl:[&>*+*]:border-stroke xl:[&>*+*]:pl-4">
              <BusinessLocationPreview
                location={business.location}
                onClick={onOpenLocation}
              />
              <BusinessHoursPreview
                operatingHours={business.operating_hours ?? []}
              />

              <BusinessContactPreview
                contactNumber={business.contact_number}
                email={business.email}
                website={business.website}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
