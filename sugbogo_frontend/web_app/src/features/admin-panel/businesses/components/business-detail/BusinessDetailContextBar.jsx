import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import StickyContextBar from "@/shared/components/StickyContextBar";
import StatusBadge from "@/shared/components/StatusBadge";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import useNavigateBack from "@/shared/hooks/useNavigateBack";
/**
 * Provides persistent business identity and status while the administrator
 * scrolls through the business detail page.
 */
export default function BusinessDetailContextBar({ business }) {
  const navigate = useNavigate();

  const status = getBusinessStatusConfig(business.status);

  const handleBack = useNavigateBack("/admin-panel/businesses");

  return (
    <StickyContextBar>
      {/* Back navigation */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={17} strokeWidth={1.8} />
        <span>Back to Businesses</span>
      </button>

      {/* Business context */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Business thumbnail */}
        <div className="hidden h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:block">
          {business.cover_photo_url ? (
            <img
              src={business.cover_photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-surface-muted" />
          )}
        </div>

        {/* Business identity and classification */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">
              {business.business_name || "Unnamed Business"}
            </p>

            <span className="hidden text-xs text-text-secondary sm:inline">
              #{business.id}
            </span>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <ClusterDisplay
              clusterName={business.cluster_name}
              clusterIcon={business.cluster_icon}
              variant="small"
            />

            <span className="text-xs text-text-secondary">·</span>

            <span className="truncate text-xs text-text-secondary">
              {business.category_name || "No category"}
            </span>
          </div>
        </div>

        {/* Business status */}
        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
      </div>
    </StickyContextBar>
  );
}
