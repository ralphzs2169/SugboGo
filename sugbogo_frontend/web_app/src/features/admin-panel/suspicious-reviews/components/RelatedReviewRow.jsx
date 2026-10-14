import { Store } from "lucide-react";
import { Link } from "react-router-dom";

import UserAvatar from "@/shared/components/UserAvatar";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { ReviewStatusBadge } from "../../moderation/components/ReviewIdentityHeader";
import { displayName } from "../utils/suspiciousReviewPresentation";
import { relatedReviewTargetId } from "../utils/relatedReviewNavigation";

function relationshipText(review, hasBaseline) {
  if (!hasBaseline) {
    return null;
  }

  if (review.referencedAtDetection && review.currentMatch) {
    return "Present at detection · Still related now";
  }

  if (review.referencedAtDetection && !review.currentMatch) {
    return "Present at detection · No longer related";
  }

  if (!review.referencedAtDetection && review.currentMatch) {
    return "Related now · Not in original evidence";
  }

  return null;
}

function RelatedReviewRow({ review, hasBaseline, reason }) {
  const { author, business } = review;
  const relationship = relationshipText(review, hasBaseline);

  return (
    <article
      id={relatedReviewTargetId(reason, review.id)}
      tabIndex={-1}
      className="scroll-mt-24 px-4 py-4 transition-colors hover:bg-interaction-hover focus:outline focus:outline-2 focus:outline-offset-[-2px] focus:outline-info/40"
    >
      {/* Review identity */}
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            Review #{review.id}
          </span>

          <ReviewStatusBadge status={review.status} />
        </div>

        {review.submitted_at && (
          <time
            dateTime={review.submitted_at}
            className="shrink-0 text-xs tabular-nums text-text-secondary"
          >
            {formatDateTime(review.submitted_at)}
          </time>
        )}
      </div>

      {/* Review content */}
      {review.text && (
        <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
          {review.text}
        </p>
      )}

      {/* Author + business */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {author && (
          <Link
            to={`/admin-panel/users/${author.id}`}
            className="group flex min-w-0 items-center gap-2"
          >
            <UserAvatar
              avatarUrl={author.avatar_url}
              avatarKey={author.avatar_key}
              size="queue"
            />

            <div className="min-w-0">
              <p className="text-[11px] text-text-secondary">Author</p>

              <p className="truncate text-xs font-medium text-text-primary group-hover:text-primary group-hover:underline">
                {displayName(author)}
              </p>
            </div>
          </Link>
        )}

        {business && (
          <Link
            to={`/admin-panel/businesses/${business.id}`}
            className="group flex min-w-0 items-center gap-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stroke bg-surface-muted">
              {business.cover_photo_url ? (
                <img
                  src={business.cover_photo_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store
                  className="h-3.5 w-3.5 text-text-secondary"
                  aria-hidden="true"
                />
              )}
            </span>

            <div className="min-w-0">
              <p className="text-[11px] text-text-secondary">Business</p>

              <p className="truncate text-xs font-medium text-text-primary group-hover:text-primary group-hover:underline">
                {business.name}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Detection/current relationship */}
      {relationship && (
        <p className="mt-3 border-t border-stroke pt-2.5 text-xs text-text-secondary">
          {relationship}
        </p>
      )}
    </article>
  );
}

export default RelatedReviewRow;
