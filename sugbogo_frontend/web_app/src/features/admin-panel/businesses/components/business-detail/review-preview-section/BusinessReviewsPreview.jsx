import { Link } from "react-router-dom";
import {
  Flag,
  Image as ImageIcon,
  MessageSquare,
  ThumbsUp,
} from "lucide-react";

import ReviewContentPreview from "./ReviewContentPreview";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatRelativeDate } from "@/shared/utils/dateUtils";
/**
 * Displays a compact, read-only preview of a business's most recent reviews.
 *
 * Mirrors the identity and content layout of the Explorer mobile app's review
 * card while keeping the admin view focused on recent activity and providing
 * direct access to the full review moderation queue.
 */
export default function BusinessReviewsPreview({
  reviews = [],
  reviewCount = 0,
  businessId,
}) {
  return (
    <section className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Recent Reviews
        </h2>

        {reviewCount > 0 && (
          <Link
            to={`/admin-panel/reviews?businessId=${businessId}`}
            className="cursor-pointer text-sm font-semibold text-primary hover:underline"
          >
            View all ({reviewCount})
          </Link>
        )}
      </div>

      {/* Section content */}
      <div className="flex flex-1">
        {reviews.length === 0 ? (
          /* Empty state */
          <div className="flex min-h-40 flex-1 flex-col items-center justify-center px-5 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
              <MessageSquare
                size={20}
                strokeWidth={1.75}
                className="text-text-secondary"
              />
            </div>

            <p className="mt-3 text-sm font-medium text-text-primary">
              No reviews yet
            </p>

            <p className="mt-1 max-w-xs text-xs text-text-secondary">
              Customer reviews will appear here once this business receives
              feedback.
            </p>
          </div>
        ) : (
          <div className="flex-1">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex gap-3 border-b border-stroke px-5 py-4"
              >
                {/* Avatar */}
                <UserAvatar
                  avatarUrl={review.author.avatar_url}
                  avatarKey={review.author.avatar_key}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  {/* Reviewer identity */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {review.author.first_name} {review.author.last_name}
                    </p>

                    <span className="shrink-0 text-xs text-text-secondary">
                      {formatRelativeDate(review.created_at)}
                    </span>
                  </div>

                  {/* Review content preview */}
                  <ReviewContentPreview review={review} />

                  {/* Review meta */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {review.like_count}
                    </span>

                    {review.photos.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {review.photos.length} photo
                        {review.photos.length > 1 ? "s" : ""}
                      </span>
                    )}

                    {review.report_count > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-danger">
                        <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {review.report_count} reported
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
