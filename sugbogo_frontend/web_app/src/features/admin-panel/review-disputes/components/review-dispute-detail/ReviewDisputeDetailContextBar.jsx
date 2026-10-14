import StatusBadge from "@/shared/components/StatusBadge";
import { formatLabel } from "@/shared/utils/stringUtils";

import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../constants/reviewDisputeStatus";

export default function ReviewDisputeDetailContextBar({ dispute, visible }) {
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div
        aria-hidden={!visible}
        className={`flex h-14 items-center justify-between gap-3 border-b border-stroke bg-background/80 px-5 backdrop-blur-md lg:px-6 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            Dispute #{dispute.id}
          </p>
          <p className="truncate text-xs text-text-secondary">
            {dispute.merchant?.name || "Merchant"} · {dispute.business?.name || "Business"} · Review #{dispute.review?.id}
          </p>
        </div>
        <StatusBadge
          variant={REVIEW_DISPUTE_STATUS_BADGE_VARIANT[dispute.status] || "mutedSoft"}
        >
          {formatLabel(dispute.status)}
        </StatusBadge>
      </div>
    </div>
  );
}
