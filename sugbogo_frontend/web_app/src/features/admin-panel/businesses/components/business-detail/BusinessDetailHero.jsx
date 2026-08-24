import { ArrowLeft, Image, MoreVertical } from "lucide-react";

import Button from "@/shared/components/Button";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import BusinessLocationPreview from "./BusinessLocationPreview";
import BusinessHoursPreview from "./BusinessHoursPreview";
import { formatOperatingHours } from "../../../business-applications/utils/operatingHours.utils";

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
 * Combines the cover photo, classification, specialty tags, description,
 * compact location preview, operating hours, and business status.
 */
export default function BusinessDetailHero({
  business,
  onBack,
  onOpenLocation,
  onOpenHours,
}) {
  const photos = business.photos ?? [];

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
          {/* Business photos */}
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

            {/* Additional business photos */}
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photos.slice(0, 4).map((photo, index) => {
                  const isLastVisible = index === 3;
                  const remainingCount = photos.length - 4;

                  return (
                    <div
                      key={photo.id ?? photo.photo_url}
                      className="relative aspect-square overflow-hidden rounded-lg border border-stroke bg-surface-muted"
                    >
                      <img
                        src={photo.photo_url}
                        alt={`${business.business_name} photo`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />

                      {isLastVisible && remainingCount > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-xs font-semibold text-white">
                            +{remainingCount}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

            {/* Location and availability */}
            {hasLocation && (
              <div className="mt-5 border-t border-stroke pt-5">
                <BusinessLocationPreview
                  location={business.location}
                  onClick={onOpenLocation}
                />

                {business.operating_hours?.length > 0 && (
                  <BusinessHoursPreview
                    operatingHours={business.operating_hours}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
