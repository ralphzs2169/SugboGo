import { useState } from "react";
import { Image as ImageIcon, Pencil, Quote, ThumbsUp } from "lucide-react";

import ReviewPhotoViewerModal from "@/shared/components/modals/ReviewPhotoViewerModal";
import { formatReviewTimestamp } from "./reviewPresentation";

export default function ReviewContentCard({ review }) {
  const [photoViewerIndex, setPhotoViewerIndex] = useState(null);
  const photos = review.photos ?? [];
  const likeCount = review.like_count ?? 0;

  return (
    <section
      aria-label="Review content"
      className="rounded-lg border border-stroke bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <Quote
          className="h-3.5 w-3.5 text-text-secondary"
          strokeWidth={2}
          aria-hidden="true"
        />
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          Review content
        </h3>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
        {review.text || "No written review."}
      </p>
      {photos.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <ImageIcon
              className="h-4 w-4 text-text-secondary"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-text-primary">
              Review photos ({photos.length})
            </h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
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
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <ThumbsUp
            className="h-3.5 w-3.5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {likeCount} found this helpful
        </span>
        {photos.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
          </span>
        )}
        {review.is_edited && (
          <span className="inline-flex items-center gap-1.5">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {review.edited_at
              ? `Edited ${formatReviewTimestamp(review.edited_at)}`
              : "Edited"}
          </span>
        )}
      </div>
      <div className="mt-6 border-l-2 border-l-primary bg-surface-muted/40 px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xs font-bold tracking-wide text-text-secondary">
            Merchant Response
          </h4>

          {review.reply?.created_at && (
            <time
              dateTime={review.reply.created_at}
              className="text-xs text-text-secondary"
              title={formatReviewTimestamp(review.reply.created_at)}
            >
              {formatReviewTimestamp(review.reply.created_at)}
            </time>
          )}
        </div>

        {review.reply ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
            {review.reply.text || "No response content available."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            Merchant hasn&apos;t responded to this review.
          </p>
        )}
      </div>
      {photoViewerIndex !== null && (
        <ReviewPhotoViewerModal
          photos={photos}
          initialIndex={photoViewerIndex}
          review={{
            ...review,
            created_at: review.created_at ?? review.submitted_at,
          }}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
    </section>
  );
}
