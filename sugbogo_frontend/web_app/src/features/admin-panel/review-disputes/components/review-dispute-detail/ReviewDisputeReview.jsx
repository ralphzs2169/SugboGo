import { Link } from "react-router-dom";
import { ExternalLink, Quote } from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import ReviewContentCard from "../../../moderation/components/ReviewContentCard";
import { ReviewStatusBadge } from "../../../moderation/components/ReviewIdentityHeader";
import { formatReviewTimestamp } from "../../../moderation/components/reviewPresentation";

export default function ReviewDisputeReview({ review }) {
  const author = review?.author;

  const authorName =
    [author?.first_name, author?.last_name].filter(Boolean).join(" ") ||
    "Unknown explorer";

  return (
    <section
      id="dispute-original-review"
      aria-label="Original review"
      className="space-y-3.5"
    >
      {/* Section heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Quote
            className="h-4 w-4 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <h3 className="text-base font-semibold text-text-primary">
            Original Review
          </h3>
        </div>

        <ReviewStatusBadge status={review?.status} />
      </div>

      {/* Review author */}
      <div className="flex min-w-0 items-center gap-2">
        <UserAvatar
          avatarUrl={author?.avatar_url}
          avatarKey={author?.avatar_key}
          size="sm"
        />

        <div className="min-w-0">
          {author?.id ? (
            <Link
              to={`/admin-panel/users/${author.id}`}
              className="
                group inline-flex min-w-0 items-center gap-1.5 rounded-sm
                text-sm font-medium text-text-primary
                transition-colors
                hover:text-primary hover:underline
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-primary
              "
            >
              <span className="truncate">{authorName}</span>

              <ExternalLink
                className="
                  h-3.5 w-3.5 shrink-0 text-text-secondary
                  transition-colors group-hover:text-primary
                "
                aria-hidden="true"
              />
            </Link>
          ) : (
            <p className="truncate text-sm font-medium text-text-primary">
              {authorName}
            </p>
          )}

          {review?.created_at && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Submitted {formatReviewTimestamp(review.created_at)}
            </p>
          )}
        </div>
      </div>

      {/* Review body */}
      <ReviewContentCard
        review={{
          ...review,
          is_edited: review?.is_edited ?? Boolean(review?.edited_at),
        }}
      />
    </section>
  );
}
