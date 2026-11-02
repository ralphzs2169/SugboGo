import { Link } from "react-router-dom";

import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import StatusBadge from "@/shared/components/StatusBadge";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import BusinessLocationPreview from "./BusinessLocationPreview";
import BusinessHoursPreview from "./BusinessHoursPreview";
import BusinessContactPreview from "./BusinessContactPreview";
import UserAvatar from "@/shared/components/UserAvatar";
import { USER_STATUS_BADGE_VARIANT } from "../../../users/constants/userManagement";
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
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          {/* Business photos and owner */}
          <div className="p-4 sm:p-5">
            {/* Cover photo */}
            <BusinessImage
              src={business.cover_photo_url}
              alt={`${business.business_name} listing image`}
              loading="eager"
              fallback="Business image unavailable"
              className="aspect-[4/3] w-full rounded-xl"
            />

            {/* Linked SugboGo account */}
            <div className="mt-4 rounded-xl border border-stroke bg-surface-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Linked Merchant Account
                </p>
              </div>

              <div className="mt-3 flex items-center gap-3">
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
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span>Account status</span>
                  <StatusBadge
                    variant={
                      USER_STATUS_BADGE_VARIANT[owner.status] || "neutral"
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
                  className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-stroke bg-background px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-info"
                >
                  <span>View account</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <p className="mt-3 text-xs text-text-secondary">
                  Account link unavailable
                </p>
              )}
            </div>
          </div>

          {/* Business identity */}
          <div className="flex min-w-0 flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-bold text-text-primary">
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
              {actions}
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
            <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2">
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
              <div className="mt-4 flex flex-wrap gap-1.5">
                {business.specialty_tags.map((tag) => (
                  <SpecialtyTagChip key={tag.id} tag={tag} showIcon />
                ))}
              </div>
            )}

            {/* About this place */}
            <BusinessDescription description={business.description} />

            {/* Location, hours & contact */}
            <div className="mt-5 space-y-4 border-t border-stroke pt-5">
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
