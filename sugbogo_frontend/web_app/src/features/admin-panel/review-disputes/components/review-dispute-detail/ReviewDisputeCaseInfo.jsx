import { Image, Info } from "lucide-react";

import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/features/admin-panel/cluster-category/constants/clusterIcons";
import { formatRelativeDate } from "@/shared/utils/dateUtils";

/**
 * Displays business context and concise moderation metadata
 * for the current review dispute attempt.
 */
export default function ReviewDisputeCaseInfo({ dispute }) {
  const business = dispute?.business;
  const merchantName = dispute?.merchant?.name || "Merchant";
  const specialtyTags = business?.specialty_tags ?? [];
  const evidenceCount = dispute?.evidence?.length ?? 0;

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

      {/* Business identity */}
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
          <p className="truncate text-sm font-bold text-text-primary">
            {business?.name || "—"}
          </p>

          {/* Business classification */}
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
      <dl className="mt-6 space-y-3.5">
        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Merchant
          </dt>

          <dd className="min-w-0 truncate text-text-primary">{merchantName}</dd>
        </div>

        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Filed
          </dt>

          <dd className="text-text-primary">
            {formatRelativeDate(dispute.created_at)}
          </dd>
        </div>

        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Attempt
          </dt>

          <dd className="font-medium text-text-primary">
            #{dispute.attempt_number ?? 1}
          </dd>
        </div>

        <div className="flex gap-4 text-sm">
          <dt className="w-20 shrink-0 font-semibold text-text-secondary">
            Evidence
          </dt>

          <dd className="text-text-primary">
            {evidenceCount} {evidenceCount === 1 ? "file" : "files"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
