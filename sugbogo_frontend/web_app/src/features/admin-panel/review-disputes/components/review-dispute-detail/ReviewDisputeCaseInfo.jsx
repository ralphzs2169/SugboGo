import { Image } from "lucide-react";

import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/features/admin-panel/cluster-category/constants/clusterIcons";
import { Info } from "lucide-react";

function relativeDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function formatLabel(value) {
  if (!value) {
    return "—";
  }

  return value.replaceAll("_", " ");
}

/**
 * Displays the business context and key dispute metadata
 * needed to understand the case at a glance.
 */
export default function ReviewDisputeCaseInfo({ dispute }) {
  const business = dispute?.business;
  const merchantName = dispute?.merchant?.name || "Merchant";
  const specialtyTags = business?.specialty_tags ?? [];

  const clusterIcon = CLUSTER_ICONS.find(
    (icon) => icon.value === business?.cluster_icon,
  );

  const ClusterIcon = clusterIcon?.icon;

  return (
    <div className="p-6">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} />

        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Case Info
        </h2>
      </div>

      {/* Business identity and classification */}
      <div className="mt-5 flex items-start gap-3">
        {business?.cover_photo_url ? (
          <img
            src={business.cover_photo_url}
            alt={`${business.name || "Business"} cover`}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-secondary">
            <Image className="h-5 w-5 text-text-secondary" strokeWidth={1.75} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Business name */}
          <p className="truncate text-sm font-bold text-text-primary">
            {business?.name || "—"}
          </p>

          {/* Classification */}
          <div className="mt-1.5 flex items-center gap-1.5">
            {ClusterIcon && (
              <ClusterIcon
                className="h-3 w-3 shrink-0 text-text-secondary"
                strokeWidth={2}
              />
            )}

            <p className="truncate text-xs text-text-secondary">
              {business?.category_name || "—"}
              {business?.cluster_name && ` · ${business.cluster_name}`}
            </p>
          </div>
        </div>
      </div>
      {/* Specialty tags */}
      {specialtyTags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {specialtyTags.slice(0, 3).map((tag) => (
            <SpecialtyTagChip key={tag.id} tag={tag} size="small" />
          ))}

          {specialtyTags.length > 3 && (
            <span className="ml-0.5 text-[10px] font-medium text-text-secondary">
              +{specialtyTags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Case metadata */}
      <dl className="mt-6 space-y-4">
        {/* Merchant */}
        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Merchant
          </dt>

          <dd className="text-text-primary">{merchantName}</dd>
        </div>

        {/* Filed */}
        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Filed
          </dt>

          <dd className="text-text-primary">
            {relativeDate(dispute.created_at)}
          </dd>
        </div>

        {/* Reason */}
        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Reason
          </dt>

          <dd className="capitalize text-text-primary">
            {formatLabel(dispute.reason)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
