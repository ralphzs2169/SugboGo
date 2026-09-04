import { useEffect, useState } from "react";
import {
  Flag,
  Image as ImageIcon,
  LoaderCircle,
  ThumbsUp,
  X,
} from "lucide-react";

import ReviewPhotoViewerModal from "@/shared/components/modals/ReviewPhotoViewerModal";

function relativeDate(value) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * Keeps a review photo's layout stable while the image is loading.
 *
 * The placeholder preserves the photo dimensions so the review modal does
 * not collapse or resize while remote images are being fetched.
 */
function ImageWithLoadingState({ src, alt, className = "" }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-surface-muted ${className}`}>
      {/* Loading placeholder */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle
            size={20}
            strokeWidth={1.75}
            className="animate-spin text-text-secondary"
          />
        </div>
      )}

      {/* Review image */}
      {!hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {/* Failed image placeholder */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon
            size={20}
            strokeWidth={1.75}
            className="text-text-secondary"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Displays the complete contents of a business review in a focused modal.
 *
 * The modal presents the reviewer's identity, complete review text, photos,
 * engagement information, and report information. Review photos open in a
 * dedicated fullscreen photo viewer.
 */
export default function ReviewPreviewModal({ review, onClose }) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);

  const hasSelectedPhoto = selectedPhotoIndex !== null;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (hasSelectedPhoto) {
          setSelectedPhotoIndex(null);
          return;
        }

        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasSelectedPhoto, onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <>
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Modal */}
        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-stroke bg-background shadow-xl">
          {/* Modal header */}
          <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {/* Reviewer avatar */}
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                {review.author.avatar_url ? (
                  <img
                    src={review.author.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-secondary">
                    {review.author.first_name?.[0]}
                    {review.author.last_name?.[0]}
                  </div>
                )}
              </div>

              {/* Reviewer identity */}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {review.author.first_name} {review.author.last_name}
                </p>

                <p className="mt-0.5 text-xs text-text-secondary">
                  {relativeDate(review.created_at)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close review"
              className="cursor-pointer rounded-lg p-2 text-text-secondary transition-colors hover:bg-stroke hover:text-text-primary"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Modal content */}
          <div className="overflow-y-auto p-5 themed-scrollbar">
            {/* Review text */}
            <div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-text-primary">
                {review.text}
              </p>
            </div>

            {/* Review photos */}
            {review.photos?.length > 0 && (
              <div className="mt-5">
                <div className="grid grid-cols-3 gap-2">
                  {review.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedPhotoIndex(index)}
                      className="aspect-square cursor-pointer overflow-hidden rounded-lg bg-surface-muted transition-opacity hover:opacity-90"
                    >
                      <ImageWithLoadingState
                        src={photo.photo_url}
                        alt={`Review photo ${index + 1}`}
                        className="h-full w-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Review engagement */}
            <div className="mt-5 flex items-center gap-4 border-t border-stroke pt-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5">
                <ThumbsUp size={15} strokeWidth={1.75} />
                {review.like_count}
                {review.like_count === 1 ? " like" : " likes"}
              </span>

              {review.photos?.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <ImageIcon size={15} strokeWidth={1.75} />
                  {review.photos.length}
                  {review.photos.length === 1 ? " photo" : " photos"}
                </span>
              )}

              {review.report_count > 0 && (
                <span className="flex items-center gap-1.5 font-semibold text-danger">
                  <Flag size={15} strokeWidth={1.75} />
                  {review.report_count} reported
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen review photo viewer */}
      {hasSelectedPhoto && (
        <ReviewPhotoViewerModal
          photos={review.photos}
          initialIndex={selectedPhotoIndex}
          review={review}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      )}
    </>
  );
}
