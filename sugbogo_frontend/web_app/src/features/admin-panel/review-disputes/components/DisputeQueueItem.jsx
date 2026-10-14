import { Store } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { formatLabel } from "@/shared/utils/stringUtils";
import { formatModerationQueueTime } from "../../moderation/components/reviewPresentation";

import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../constants/reviewDisputeStatus";

function DisputeReasonBadge({ reason }) {
  if (!reason) {
    return null;
  }

  return (
    <span
      className="
        inline-flex items-center rounded-lg
        border border-stroke bg-surface-muted
        px-2 py-1
        text-xs font-medium text-text-primary
      "
    >
      {formatLabel(reason)}
    </span>
  );
}

export default function DisputeQueueItem({ dispute, selected, onSelect }) {
  const merchant = dispute.merchant ?? {};
  const reviewPreview = dispute.review_text_preview?.trim();

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full cursor-pointer border-b border-l-[3px] border-stroke px-4 py-3.5 text-left transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-info ${
        selected
          ? "border-l-info bg-info/5 hover:bg-info/10"
          : "border-l-transparent bg-background hover:bg-interaction-hover"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar
          avatarUrl={merchant.avatar_url}
          avatarKey={merchant.avatar_key}
          size="queue"
        />

        <div className="min-w-0 flex-1">
          {/* Merchant + queue timestamp */}
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {merchant.name || "Merchant"}
            </span>

            {dispute.created_at && (
              <time
                dateTime={dispute.created_at}
                title={formatDateTime(dispute.created_at)}
                className="shrink-0 text-xs text-text-secondary"
              >
                {formatModerationQueueTime(dispute.created_at)}
              </time>
            )}
          </div>

          {/* Business + review identity */}
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="
                flex h-6 w-6 shrink-0 items-center justify-center
                overflow-hidden rounded-md border border-stroke
                bg-surface-muted
              "
            >
              {dispute.business_cover_photo_url ? (
                <img
                  src={dispute.business_cover_photo_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>

            <span className="min-w-0 truncate" title={dispute.business_name}>
              {dispute.business_name}
            </span>

            <span aria-hidden="true">·</span>

            <span className="shrink-0">Review #{dispute.review_id}</span>
          </div>

          {/* Original review preview */}
          <p className="mt-2 line-clamp-2 break-words text-sm leading-5 text-text-primary">
            {reviewPreview
              ? reviewPreview
              : dispute.review_photo_count > 0
                ? "Photo review"
                : "No written review"}
          </p>

          {/* Dispute reason */}
          <div className="mt-2">
            <DisputeReasonBadge reason={dispute.reason} />
          </div>

          {/* Case metadata */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-xs text-text-secondary">
              Attempt #{dispute.attempt_number}
            </span>

            <StatusBadge
              variant={
                REVIEW_DISPUTE_STATUS_BADGE_VARIANT[dispute.status] ||
                "mutedSoft"
              }
            >
              {formatLabel(dispute.status)}
            </StatusBadge>
          </div>
        </div>
      </div>
    </button>
  );
}
