import { Image, MapPin, Tag } from "lucide-react";
import ClusterDisplay from "@/shared/components/ClusterDisplay";

/**
 * Displays a compact business preview inside the management map InfoWindow.
 *
 * Shows the storefront image, business identity, classification, location,
 * status, and an explicit action for opening the business management page.
 */
export default function BusinessMapInfoWindow({ business, onView }) {
  const photoUrl = business.storefront_photo?.url;

  return (
    <div className="w-[240px] overflow-hidden">
      {/* Business photo */}
      <div className="relative">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${business.business_name} storefront`}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-gray-100">
            <Image className="h-8 w-8 text-gray-400" strokeWidth={1.75} />
          </div>
        )}

        {/* Business cluster */}
        <div className="absolute right-2 top-2">
          <ClusterDisplay
            clusterName={business.cluster_name}
            clusterIcon={business.cluster_icon}
            variant="badge"
          />
        </div>
      </div>

      {/* Business information */}
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-gray-900">
          {business.business_name || "Unnamed business"}
        </p>

        {/* Business category */}
        {business.category_name && (
          <div className="mt-1 flex items-center gap-1.5">
            <Tag
              className="h-3 w-3 shrink-0 text-gray-400"
              strokeWidth={1.75}
            />

            <p className="truncate text-xs text-gray-600">
              {business.category_name}
            </p>
          </div>
        )}

        {/* Business location */}
        {business.location && (
          <div className="mt-1 flex items-center gap-1.5">
            <MapPin
              className="h-3 w-3 shrink-0 text-gray-400"
              strokeWidth={1.75}
            />

            <p className="truncate text-xs text-gray-600">
              {business.location}
            </p>
          </div>
        )}

        {/* Business status */}
        {business.status && (
          <p
            className={`mt-1 text-xs font-medium capitalize ${
              business.status === "active"
                ? "text-emerald-600"
                : business.status === "suspended"
                  ? "text-amber-600"
                  : "text-gray-700"
            }`}
          >
            {business.status}
          </p>
        )}

        {/* Business action */}
        {onView && (
          <button
            type="button"
            onClick={() => onView(business)}
            className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            View business
          </button>
        )}
      </div>
    </div>
  );
}
