import { useState } from "react";
import StatusBadge from "@/shared/components/StatusBadge";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import { ArrowRight, Image, MapPin, Tag } from "lucide-react";
import ClusterDisplay from "@/shared/components/ClusterDisplay";

/**
 * Displays a compact business preview inside the management map InfoWindow.
 *
 * Shows the storefront image, business identity, classification, location,
 * status, and an explicit action for opening the business management page.
 */
export default function BusinessMapInfoWindow({ business, onView }) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  const photoUrl = business.cover_photo_url;
  const status = getBusinessStatusConfig(business.status);

  return (
    <div className="w-full overflow-hidden px-3 pb-4">
      {/* Business photo */}
      <div className="relative overflow-hidden rounded-lg">
        {photoUrl && failedPhoto !== photoUrl ? (
          <img
            src={photoUrl}
            onError={() => setFailedPhoto(photoUrl)}
            alt={`${business.business_name} storefront`}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-surface-muted">
            <Image className="h-8 w-8 text-text-secondary" strokeWidth={1.75} />
          </div>
        )}

        {/* Business cluster */}
        <div className="absolute right-2 top-2 max-w-[calc(100%-16px)]">
          <ClusterDisplay
            clusterName={business.cluster_name}
            clusterIcon={business.cluster_icon}
            variant="badge"
            className="max-w-full border border-stroke text-xs [&>span]:truncate [&>svg]:shrink-0 [&>svg]:text-primary"
          />
        </div>
      </div>

      {/* Business information */}
      <div className="px-2 pt-3">
        <p
          title={business.business_name}
          className="line-clamp-2 text-base font-bold leading-5 text-text-primary"
        >
          {business.business_name || "Unnamed business"}
        </p>

        {/* Business category */}
        {business.category_name && (
          <div className="mt-1 flex items-center gap-1.5">
            <Tag
              className="h-3 w-3 shrink-0 text-text-secondary"
              strokeWidth={1.75}
            />

            <p
              title={business.category_name}
              className="truncate text-xs text-text-secondary"
            >
              {business.category_name}
            </p>
          </div>
        )}

        {/* Business location */}
        {business.location && (
          <div className="mt-1 flex items-center gap-1.5">
            <MapPin
              className="h-3 w-3 shrink-0 text-text-secondary"
              strokeWidth={1.75}
            />

            <p
              title={business.location}
              className="truncate text-xs text-text-secondary"
            >
              {business.location}
            </p>
          </div>
        )}

        {/* Business status */}
        <div className="mt-2">
          <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
        </div>

        {/* Business action */}
        {onView && (
          <button
            type="button"
            onClick={() => onView(business)}
            className="mt-3 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>View business</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
