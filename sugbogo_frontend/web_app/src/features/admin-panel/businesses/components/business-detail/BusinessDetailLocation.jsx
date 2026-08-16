import { ArrowLeft, Image, MoreVertical } from "lucide-react";

import Button from "@/shared/components/Button";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import UserAvatar from "@/shared/components/UserAvatar";
import BusinessLocationPreview from "./BusinessLocationPreview";

const STATUS_CONFIG = {
  active: {
    label: "Active",
    className: "bg-success/10 text-success",
  },
  suspended: {
    label: "Suspended",
    className: "bg-warning/10 text-warning",
  },
};

/**
 * Displays the primary identity of a permanent business.
 *
 * Combines the storefront, classification, specialty tags, owner,
 * business status, description, and compact location preview into
 * the business profile header.
 */
export default function BusinessDetailHero({
  business,
  onBack,
  onOpenLocation,
}) {
  const storefrontPhoto = business.photos?.find(
    (photo) => photo.category === "storefront",
  );

  const status = STATUS_CONFIG[business.status] ?? {
    label: business.status ?? "Unknown",
    className: "bg-surface text-text-secondary",
  };

  const hasLocation =
    business.location?.latitude != null && business.location?.longitude != null;

  return (
    <section>
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        onClick={onBack}
        className="mb-4"
      >
        Back to Businesses
      </Button>

      {/* Business profile */}
      <div className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,420px)_1fr]">
          {/* Storefront */}
          <div className="p-4 sm:p-5 lg:min-h-[300px]">
            <div className="relative h-full min-h-[260px] overflow-hidden rounded-xl bg-surface-muted">
              {storefrontPhoto?.url ? (
                <img
                  src={storefrontPhoto.url}
                  alt={`${business.business_name} storefront`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Image
                    className="h-10 w-10 text-text-secondary"
                    strokeWidth={1.5}
                  />
                </div>
              )}
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

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${status.className}`}
                  >
                    {status.label}
                  </span>
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
                variant="badge"
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
                  <SpecialtyTagChip key={tag.id} tag={tag} />
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

            {/* Owner */}
            <div className="mt-6 flex items-center gap-3 border-t border-stroke pt-5">
              <UserAvatar avatarUrl={business.owner?.avatar_url} size="sm" />

              <div className="min-w-0">
                <p className="text-xs text-text-secondary">Owner</p>

                <p className="truncate text-sm font-semibold text-text-primary">
                  {business.owner?.name || "Unknown owner"}
                </p>

                {business.owner?.email && (
                  <p className="truncate text-xs text-text-secondary">
                    {business.owner.email}
                  </p>
                )}
              </div>
            </div>

            {/* Location preview */}
            {hasLocation && (
              <div className="mt-5 border-t border-stroke pt-5">
                <BusinessLocationPreview
                  location={business.location}
                  onClick={onOpenLocation}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
