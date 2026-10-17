import { useState } from "react";
import { Image as ImageIcon, Pencil, ThumbsUp } from "lucide-react";

import ReviewPhotoViewerModal from "@/shared/components/modals/ReviewPhotoViewerModal";
import { formatReviewTimestamp } from "./reviewPresentation";

export default function ReviewContentCard({ review }) {
  const [photoViewerIndex, setPhotoViewerIndex] = useState(null);

  const photos = review.photos ?? [];
  const hasLikeCount = typeof review.like_count === "number";

  return (
    <section
      aria-label="Review content"
      className="rounded-lg border border-stroke bg-surface p-4"
    >
      {/* Review text */}
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
        {review.text || "No written review."}
      </p>

      {/* Review photos */}
      {photos.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <ImageIcon
              className="h-4 w-4 text-text-secondary"
              strokeWidth={1.75}
              aria-hidden="true"
            />

            <h4 className="text-sm font-semibold text-text-primary">
              Review photos ({photos.length})
            </h4>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setPhotoViewerIndex(index)}
                className="
                  w-full max-w-[200px] cursor-pointer overflow-hidden rounded-lg
                  border border-stroke text-left
                  transition-colors hover:bg-interaction-hover
                  focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-primary
                "
                aria-label={`View review photo ${index + 1}`}
              >
                <img
                  src={photo.photo_url}
                  alt={`Review photo ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover"
                />

                <span className="block px-2 py-1.5 text-xs text-text-secondary">
                  Photo {index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review metadata */}
      {(hasLikeCount || review.is_edited) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary">
          {hasLikeCount && (
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp
                className="h-3.5 w-3.5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {review.like_count} found this helpful
            </span>
          )}

          {review.is_edited && (
            <span className="inline-flex items-center gap-1.5">
              <Pencil
                className="h-3.5 w-3.5"
                strokeWidth={1.75}
                aria-hidden="true"
              />

              {review.edited_at
                ? `Edited ${formatReviewTimestamp(review.edited_at)}`
                : "Edited"}
            </span>
          )}
        </div>
      )}

      {/* Merchant response — only shown when a reply exists */}
      {review.reply && (
        <div
          className="
            mt-4
            border-l-2 border-l-primary
            bg-surface-muted/40 px-4 py-3
          "
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h4 className="text-xs font-semibold text-text-secondary">
              Merchant Response
            </h4>

            {review.reply.created_at && (
              <time
                dateTime={review.reply.created_at}
                className="shrink-0 text-xs text-text-secondary"
              >
                {formatReviewTimestamp(review.reply.created_at)}
              </time>
            )}
          </div>

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
            {review.reply.text || "No response content available."}
          </p>
        </div>
      )}

      {/* Photo viewer */}
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
