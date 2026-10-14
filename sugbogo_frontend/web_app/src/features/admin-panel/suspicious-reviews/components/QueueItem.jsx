import { Image as ImageIcon, MessageSquare, Pencil, Store } from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { formatModerationQueueTime } from "../../moderation/components/reviewPresentation";
import { displayName } from "../utils/suspiciousReviewPresentation";
import SignalBadges from "./SignalBadges";

function QueueItem({ review, selected, onSelect }) {
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
          avatarUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size="queue"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {displayName(review.author)}
            </span>
            <time dateTime={review.submitted_at} title={formatDateTime(review.submitted_at)} className="shrink-0 text-xs text-text-secondary">
              {formatModerationQueueTime(review.submitted_at)}
            </time>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stroke bg-surface-muted">
              {review.business.cover_photo_url ? (
                <img src={review.business.cover_photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 truncate" title={review.business.name}>{review.business.name}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">Review #{review.id}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-text-primary">
            {review.text_preview || "Photo review"}
          </p>
          <div className="mt-2">
            <SignalBadges reasons={review.reasons} roundedClassName="rounded-lg" />
          </div>
          {(review.photo_count > 0 || review.has_reply || review.is_edited) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
              {review.photo_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {review.photo_count} {review.photo_count === 1 ? "photo" : "photos"}
                </span>
              )}
              {review.has_reply && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  Merchant replied
                </span>
              )}
              {review.is_edited && (
                <span className="inline-flex items-center gap-1">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edited
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default QueueItem;
