import { createColumnHelper } from "@tanstack/react-table";
import { Image } from "lucide-react";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { formatDateTime } from "@/shared/utils/dateUtils";

const columnHelper = createColumnHelper();

function scoreValue(value) {
  return value == null ? "—" : String(value);
}

/** Defines score columns using the shared Admin DataTable cell conventions. */
export default function getDiscoveryScoreColumns() {
  return [
    columnHelper.accessor((row) => row.business.business_name, {
      id: "business_name",
      header: "Business",
      size: 360,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const business = row.original.business;
        const tags = business.specialty_tags ?? [];
        return (
          <div className="flex min-w-0 items-center gap-3">
            {/* Cover photo uses the same fallback as the business table. */}
            {business.cover_photo_url ? (
              <img
                src={business.cover_photo_url}
                alt={`${business.business_name} cover`}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-secondary">
                <Image className="h-5 w-5 text-text-secondary" />
              </div>
            )}

            {/* Identity and classification. */}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">
                {business.business_name}
              </p>
              <p className="truncate text-xs text-text-secondary">
                {business.cluster_name} • {business.category_name}
              </p>
              {tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tags.slice(0, 3).map((tag) => (
                    <SpecialtyTagChip key={tag.id} tag={tag} size="small" />
                  ))}
                  {tags.length > 3 && (
                    <span className="text-xs text-text-secondary">
                      +{tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("specialty_score", {
      header: "Specialty Score",
      size: 150,
      meta: { skeleton: "number" },
      cell: (info) => (
        <span className="font-mono text-sm tabular-nums text-text-primary">
          {scoreValue(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("visibility_gap", {
      header: "Visibility Gap",
      size: 150,
      meta: { skeleton: "number" },
      cell: (info) => (
        <span className="font-mono text-sm tabular-nums text-text-primary">
          {scoreValue(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("discovery_score", {
      header: "Discovery Score",
      size: 160,
      meta: { skeleton: "number" },
      cell: (info) => (
        <strong className="font-mono text-sm tabular-nums text-text-primary">
          {scoreValue(info.getValue())}
        </strong>
      ),
    }),
    columnHelper.accessor("computed_at", {
      header: "Last Updated",
      size: 180,
      meta: { skeleton: "text" },
      cell: (info) => (
        <span className="text-sm text-text-secondary">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
  ];
}
