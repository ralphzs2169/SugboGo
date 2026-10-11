import { Link } from "react-router-dom";
import { Clock3, Image as ImageIcon, UserRound } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import { formatDateTime } from "@/shared/utils/dateUtils";

import useUnderReviewReview from "../hooks/useUnderReviewReview";
import UnderReviewFindings from "./UnderReviewFindings";

function DetailPlaceholder({ title, description }) {
  return (
    <div className="flex min-h-[460px] flex-col items-center justify-center px-8 text-center">
      <ShieldIcon />
      <h2 className="mt-4 text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
    </div>
  );
}

function ShieldIcon() {
  return <UserRound className="h-9 w-9 text-text-secondary" />;
}

export default function UnderReviewDetail({
  reviewId,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  onStale,
}) {
  const { review, isLoading, error, refetch } = useUnderReviewReview(reviewId);

  if (!reviewId) {
    return (
      <DetailPlaceholder
        title="Select a review"
        description="Choose a review from the queue to inspect its content and moderation findings."
      />
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-5 p-6">
        <div className="h-6 w-52 animate-pulse rounded bg-surface" />
        <div className="h-24 animate-pulse rounded bg-surface" />
        <div className="h-48 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (error) {
    return (
      <DataErrorState
        title="Unable to load this review"
        message="The review may have been resolved by another Admin. Refresh the queue or try again."
        onRetry={() => {
          if (error.response?.status === 404) {
            onStale?.();
          } else {
            refetch();
          }
        }}
      />
    );
  }

  if (!review) {
    return null;
  }

  const authorName = [review.author.first_name, review.author.last_name]
    .filter(Boolean)
    .join(" ");
  const isSubmitting = isApproving || isRejecting;

  return (
    <div className="flex min-h-[640px] flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 lg:max-h-[calc(100vh-250px)] lg:p-6">
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              Review #{review.id}
            </h2>
            <StatusBadge variant="warning">Under Review</StatusBadge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary">
            <span>
              Author: <Link className="font-medium text-primary hover:underline" to={`/admin-panel/users/${review.author.id}`}>{authorName}</Link>
            </span>
            <span>
              Business: <Link className="font-medium text-primary hover:underline" to={`/admin-panel/businesses/${review.business.id}`}>{review.business.name}</Link>
            </span>
          </div>
        </header>

        <section className="rounded-xl border border-stroke bg-background p-5">
          <h3 className="text-sm font-semibold text-text-primary">Review content</h3>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
            {review.text || "No written review."}
          </p>
        </section>

        <section className="rounded-xl border border-stroke bg-background p-5">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Photos ({review.photos.length})
            </h3>
          </div>
          {review.photos.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {review.photos.map((photo, index) => (
                <a
                  key={photo.id}
                  href={photo.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-lg border border-stroke focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label={`Open photo ${index + 1}`}
                >
                  <img
                    src={photo.photo_url}
                    alt={`Review photo ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="block px-2 py-1 text-xs text-text-secondary">
                    Photo {index + 1}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">No photos attached.</p>
          )}
        </section>

        <UnderReviewFindings review={review} />

        <section className="rounded-xl border border-stroke bg-background p-5">
          <h3 className="text-sm font-semibold text-text-primary">Submission context</h3>
          <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
            <Clock3 className="h-4 w-4" />
            Submitted {formatDateTime(review.submitted_at)}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-stroke bg-background p-4 lg:px-6">
        <Button
          variant="danger-outline"
          onClick={onReject}
          disabled={isSubmitting}
        >
          Reject Review
        </Button>
        <Button
          variant="success"
          onClick={onApprove}
          loading={isApproving}
          disabled={isSubmitting}
        >
          Approve &amp; Publish
        </Button>
      </div>
    </div>
  );
}
