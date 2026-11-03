import { ArrowLeft } from "lucide-react";

import StickyContextBar from "@/shared/components/StickyContextBar";
import StatusBadge from "@/shared/components/StatusBadge";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import useNavigateBack from "@/shared/hooks/useNavigateBack";
import BusinessImage from "./BusinessImage";
/**
 * Provides persistent business identity and status while the administrator
 * scrolls through the business detail page.
 */
export default function BusinessDetailContextBar({ business }) {
  const status = getBusinessStatusConfig(business.status);

  const handleBack = useNavigateBack("/admin-panel/businesses");

  return (
    <StickyContextBar responsive ariaLabel="Business context">
      {/* Back navigation */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex w-full shrink-0 cursor-pointer items-center gap-2 text-sm font-medium transition-colors hover:text-text-primary sm:w-auto"
      >
        <ArrowLeft size={17} strokeWidth={1.8} />
        <span>Back to Businesses</span>
      </button>

      {/* Business context */}
      <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:flex-1 sm:justify-end">
        {/* Business thumbnail */}
        <div className="hidden h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:block">
          <BusinessImage
            src={business.cover_photo_url}
            alt=""
            fallback=""
            className="h-full w-full"
          />
        </div>

        {/* Business identity and classification */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">
              {business.business_name || "Unnamed Business"}
            </p>

            <span className="shrink-0 text-xs text-text-secondary">
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
