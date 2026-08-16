import { ArrowLeft, Image, MapPin, MoreVertical } from "lucide-react";
import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";

import Button from "@/shared/components/Button";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import UserAvatar from "@/shared/components/UserAvatar";
import GoogleMapsProvider from "@/features/admin-panel/providers/GoogleMapsProvider";
import BusinessMapMarker from "../../../business-applications/components/review/business-location/BusinessMapMarker";

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
 * current business status, and a compact location preview into the
 * business header.
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

  const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;

  const locationPosition = hasLocation
    ? {
        lat: Number(business.location.latitude),
        lng: Number(business.location.longitude),
      }
    : null;

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

            {/* Owner and location */}
            <div className="mt-6 grid grid-cols-1 gap-5 border-t border-stroke pt-5 lg:grid-cols-2">
              {/* Owner */}
              <div className="flex items-center gap-3">
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
                <button
                  type="button"
                  onClick={onOpenLocation}
                  className="group flex cursor-pointer items-center gap-3 text-left"
                >
                  {/* Compact map */}
                  <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-stroke bg-surface-muted">
                    <div className="pointer-events-none h-full w-full">
                      <GoogleMapsProvider>
                        <Map
                          defaultCenter={locationPosition}
                          defaultZoom={16}
                          mapId={GOOGLE_MAP_ID}
                          disableDefaultUI
                          gestureHandling="none"
                        >
                          <AdvancedMarker position={locationPosition}>
                            <BusinessMapMarker variant="business" />
                          </AdvancedMarker>
                        </Map>
                      </GoogleMapsProvider>
                    </div>

                    {/* Preview overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                      <span className="rounded-full bg-background/95 px-2.5 py-1.5 text-xs font-semibold text-text-primary opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        View map
                      </span>
                    </div>
                  </div>

                  {/* Location summary */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        size={14}
                        strokeWidth={1.8}
                        className="text-text-secondary"
                      />

                      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Location
                      </p>
                    </div>

                    <p className="mt-1 truncate text-sm font-medium text-text-primary">
                      {business.location.address || "No address"}
                    </p>

                    <p className="mt-1 text-xs text-text-secondary">
                      {business.location.city}, {business.location.province}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
