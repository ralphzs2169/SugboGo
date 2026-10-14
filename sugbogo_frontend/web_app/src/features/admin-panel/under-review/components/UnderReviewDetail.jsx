import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Pencil,
  Quote,
  ThumbsUp,
  UserRound,
} from "lucide-react";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import ReviewPhotoViewerModal from "@/shared/components/modals/ReviewPhotoViewerModal";
import { formatDateTime, formatRelativeDate } from "@/shared/utils/dateUtils";

import useUnderReviewReview from "../hooks/useUnderReviewReview";
import UnderReviewFindings from "./UnderReviewFindings";
import ReviewIdentityHeader from "../../moderation/components/ReviewIdentityHeader";
import ReviewStickyContextBar from "../../moderation/components/ReviewStickyContextBar";
import ModerationDetailSkeleton from "../../moderation/components/ModerationDetailSkeleton";

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

function formatHeaderTimestamp(value) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  const day = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${day} · ${time}`;
}

export default function UnderReviewDetail({
  reviewId,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  onStale,
}) {
  const scrollContainerRef = useRef(null);
  const reviewHeaderRef = useRef(null);
  const [showContextBar, setShowContextBar] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(null);
  const { review, isLoading, error, refetch } = useUnderReviewReview(reviewId);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const reviewHeader = reviewHeaderRef.current;

    if (!scrollContainer || !reviewHeader) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContextBar(!entry.isIntersecting);
      },
      {
        root: scrollContainer,
        threshold: 0,
      },
    );

    observer.observe(reviewHeader);

    return () => observer.disconnect();
  }, [review?.id]);

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
      <ModerationDetailSkeleton
        label="Loading under-review review"
        sections={["Moderation Findings"]}
        showDecision
      />
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

  const isSubmitting = isApproving || isRejecting;

  return (
    <div className="flex min-h-[640px] flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100vh-250px)]"
        ref={scrollContainerRef}
      >
        <ReviewStickyContextBar review={review} visible={showContextBar} />
        <div ref={reviewHeaderRef} className="border-b border-stroke bg-background px-5 py-4 lg:px-6">
          <ReviewIdentityHeader review={review} />
        </div>

        <section className="mx-5 mt-5 rounded-lg border border-stroke bg-surface p-4 lg:mx-6 lg:mt-6">
          <div className="flex items-center gap-2">
            <Quote className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              Review content
            </h3>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
            {review.text || "No written review."}
          </p>
          {review.photos.length ? (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Review photos ({review.photos.length})
                </h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {review.photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPhotoViewerIndex(index)}
                    className="cursor-pointer overflow-hidden rounded-lg border border-stroke text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`View review photo ${index + 1}`}
                  >
                    <img
                      src={photo.photo_url}
                      alt={`Review photo ${index + 1}`}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span className="block px-2 py-1 text-xs text-text-secondary">
                      Photo {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {review.like_count ?? 0} {(review.like_count ?? 0) === 1 ? "like" : "likes"}
            </span>
            {review.photos.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {review.photos.length} {review.photos.length === 1 ? "photo" : "photos"}
              </span>
            )}
            {review.is_edited && (
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {review.edited_at
                  ? `Edited ${formatHeaderTimestamp(review.edited_at)}`
                  : "Edited"}
              </span>
            )}
          </div>
          {review.reply && (
            <div className="mt-6 border-l-2 border-primary bg-surface-muted/40 px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  Merchant Response
                </h4>
                {review.reply.created_at && (
                  <time
                    dateTime={review.reply.created_at}
                    className="text-xs text-text-secondary"
                    title={formatDateTime(review.reply.created_at)}
                  >
                    {formatRelativeDate(review.reply.created_at)}
                  </time>
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-text-primary">
                {review.business.name}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                {review.reply.text || "No response content available."}
              </p>
            </div>
          )}
        </section>

        <div className="mx-5 my-6 lg:mx-6">
          <UnderReviewFindings review={review} />
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-stroke bg-background px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-6">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">Admin Decision</h3>
          <p className="mt-0.5 text-xs leading-5 text-text-secondary">
            Review the content and findings before deciding whether to publish or reject this review.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
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
      {photoViewerIndex !== null && (
        <ReviewPhotoViewerModal
          photos={review.photos}
          initialIndex={photoViewerIndex}
          review={{
            ...review,
            created_at: review.created_at ?? review.submitted_at,
          }}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
    </div>
  );
}
