import { Link } from "react-router-dom";
import { ExternalLink, Quote } from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import { formatLabel } from "@/shared/utils/stringUtils";
import ReviewContentCard from "../../../moderation/components/ReviewContentCard";
import { ReviewStatusBadge } from "../../../moderation/components/ReviewIdentityHeader";
import { formatReviewTimestamp } from "../../../moderation/components/reviewPresentation";

function ReviewVersion({ review, title }) {
  const author = review?.author;

  const authorName =
    [author?.first_name, author?.last_name].filter(Boolean).join(" ") ||
    "Unknown explorer";

  return (
    <section aria-label={title} className="space-y-3.5">
      {/* Section heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Quote
            className="h-4 w-4 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <h3 className="text-base font-semibold text-text-primary">
            {title}
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

export default function ReviewDisputeReview({ dispute }) {
  const snapshot = dispute.review_at_filing;
  const currentReview = dispute.current_review?.exists === true
    ? dispute.current_review
    : null;
  const snapshotAvailable = snapshot?.available === true;
  const changed = dispute.material_content_changed === true;
  const deleted = dispute.current_review?.exists === false;
  const closureReasons = {
    content_removed_by_author:
      "Closed without an Admin decision because the author deleted the review.",
    original_review_removed:
      "Closed without an Admin decision because the original review was removed.",
  };
  let filingReview = null;

  if (snapshotAvailable) {
    const author = currentReview?.author?.id === snapshot.author_id
      ? currentReview.author
      : { first_name: snapshot.author_id ? `Explorer #${snapshot.author_id}` : "Unknown explorer" };

    filingReview = {
      id: snapshot.review_id,
      text: snapshot.text,
      status: snapshot.status,
      created_at: snapshot.submitted_at,
      edited_at: snapshot.edited_at,
      author,
      photos: [...(snapshot.photos ?? [])]
        .sort((first, second) => first.display_order - second.display_order)
        .map((photo) => ({ id: photo.id, photo_url: photo.url })),
    };
  }

  return (
    <section aria-label="Original review" className="space-y-5">
      {changed && currentReview && (
        <p className="text-xs leading-5 text-text-secondary">
          The review changed after this dispute was filed. Compare the filing-time
          evidence with the current review before deciding.
        </p>
      )}
      {deleted && (
        <div className="space-y-1 text-sm leading-6 text-text-secondary">
          <p>The original review has been deleted. Historical dispute evidence is preserved.</p>
          {dispute.closure_reason && (
            <p>
              {closureReasons[dispute.closure_reason] ?? formatLabel(dispute.closure_reason)}
            </p>
          )}
        </div>
      )}
      {filingReview ? (
        <>
          <ReviewVersion
            review={filingReview}
            title={changed || deleted ? "Review at Filing" : "Original Review"}
          />
          {!changed && currentReview && currentReview.status !== filingReview.status && (
            <p className="text-xs text-text-secondary">
              Current review status: {formatLabel(currentReview.status)}.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-text-secondary">Filing-time snapshot unavailable</p>
      )}
      {currentReview && (changed || !snapshotAvailable) && (
        <ReviewVersion review={currentReview} title="Current Review" />
      )}
    </section>
  );
}
