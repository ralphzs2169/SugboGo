import { Image, MoreVertical } from "lucide-react";

import Button from "@/shared/components/Button";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import StatusBadge from "@/shared/components/StatusBadge";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import BusinessLocationPreview from "./BusinessLocationPreview";
import BusinessHoursPreview from "./BusinessHoursPreview";
import BusinessContactPreview from "./BusinessContactPreview";
import UserAvatar from "@/shared/components/UserAvatar";

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
  onOpenHours,
}) {
  const photos = business.photos ?? [];
  const owner = business.owner;
  const status = getBusinessStatusConfig(business.status);

  const hasLocation =
    business.location?.latitude != null && business.location?.longitude != null;

  const hasContact =
    business.contact_number || business.email || business.website;

  return (
    <section>
      {/* Business profile */}
      <div className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,420px)_1fr]">
          {/* Business photos and owner */}
          <div className="p-4 sm:p-5">
            {/* Cover photo */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-muted">
              {business.cover_photo_url ? (
                <img
                  src={business.cover_photo_url}
                  alt={`${business.business_name} cover`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5">
                  <Image
                    className="h-10 w-10 text-text-secondary"
                    strokeWidth={1.5}
                  />

                  <span className="text-xs font-medium text-text-secondary">
                    No cover photo
                  </span>
                </div>
              )}
            </div>

            {/* Linked SugboGo account */}
            <div className="mt-4 rounded-xl border border-stroke bg-surface-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Linked Merchant Account
                </p>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <UserAvatar avatarUrl={owner?.avatar_url} size="lg" />

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

              <button
                type="button"
                className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-stroke bg-background px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <span>View account</span>
                <span className="text-sm">→</span>
              </button>
            </div>
          </div>

          {/* Business identity */}
          <div className="flex flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-text-primary">
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
              <Button
                variant="action"
                size="sm"
                icon={MoreVertical}
                iconOnly
                tooltipMessage="Business actions"
              />
            </div>

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
            {business.description && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  About this place
                </p>

                <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-text-secondary">
                  {business.description}
                </p>
              </div>
            )}

            {/* Location, hours & contact */}
            {(hasLocation || hasContact) && (
              <div className="mt-5 border-t border-stroke pt-5">
                {hasLocation && (
                  <BusinessLocationPreview
                    location={business.location}
                    onClick={onOpenLocation}
                  />
                )}

                {business.operating_hours?.length > 0 && (
                  <BusinessHoursPreview
                    operatingHours={business.operating_hours}
                  />
                )}

                <BusinessContactPreview
                  contactNumber={business.contact_number}
                  email={business.email}
                  website={business.website}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
