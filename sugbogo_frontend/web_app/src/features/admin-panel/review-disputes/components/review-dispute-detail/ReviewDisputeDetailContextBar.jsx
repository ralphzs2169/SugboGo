import { ArrowLeft } from "lucide-react";

import StickyContextBar from "@/shared/components/StickyContextBar";
import StatusBadge from "@/shared/components/StatusBadge";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../constants/reviewDisputeStatus";
import { formatLabel } from "@/shared/utils/stringUtils";

/**
 * Provides persistent dispute identity, business context, and status while
 * the administrator scrolls through a review dispute detail page.
 */
export default function ReviewDisputeDetailContextBar({ dispute }) {
  const handleBack = useNavigateBack("/admin-panel/review-disputes");

  const statusVariant =
    REVIEW_DISPUTE_STATUS_BADGE_VARIANT[dispute.status] || "neutral";

  return (
    <StickyContextBar>
      {/* Back navigation */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={17} strokeWidth={1.8} />
        <span>Back to Disputes</span>
      </button>

      {/* Dispute context */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Dispute identity */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="shrink-0 text-sm font-semibold text-text-primary">
              Dispute #{dispute.id}
            </p>

            <span className="text-xs text-text-secondary">·</span>

            <p className="truncate text-sm text-text-secondary">
              {dispute.business?.name || "Unnamed Business"}
            </p>
          </div>

          <p className="hidden truncate text-xs text-text-secondary md:block">
            Review #{dispute.review?.id} · Attempt #{dispute.attempt_number}
          </p>
        </div>

        {/* Dispute status */}
        <StatusBadge variant={statusVariant}>
          {formatLabel(dispute.status)}
        </StatusBadge>
      </div>
    </StickyContextBar>
  );
}
