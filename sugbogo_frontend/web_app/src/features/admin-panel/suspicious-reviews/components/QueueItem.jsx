import { Image as ImageIcon, MessageSquare, Pencil } from "lucide-react";

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
      className={`w-full cursor-pointer border-b border-l-2 border-stroke px-4 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        selected
          ? "border-l-primary bg-primary/5 hover:bg-primary/10"
          : "border-l-transparent bg-background hover:bg-interaction-hover"
      }`}
    >
      <div className="flex items-start gap-2">
        <UserAvatar
          avatarUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size="sm"
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
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            Review #{review.id} · {review.business.name}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <p className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-text-primary">
              {review.text_preview || "Photo review"}
            </p>
            {review.first_photo_url && (
              <img src={review.first_photo_url} alt="Review photo thumbnail" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-stroke object-cover" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <SignalBadges reasons={review.reasons} />
            {review.photo_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {review.photo_count} {review.photo_count === 1 ? "photo" : "photos"}
              </span>
            )}
            {review.has_reply && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Reply
              </span>
            )}
            {review.is_edited && (
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edited
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default QueueItem;
