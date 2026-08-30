import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Provides a fullscreen, focused viewer for review photos.
 *
 * Displays the review author, photo counter, navigation controls, and
 * pagination while keeping the photo centered against a dark backdrop.
 */
export default function ReviewPhotoViewerModal({
  photos = [],
  initialIndex = 0,
  review,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)),
  );

  useEffect(() => {
    setCurrentIndex(
      Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)),
    );
  }, [initialIndex, photos.length]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft" && photos.length > 1) {
        setCurrentIndex((currentIndex - 1 + photos.length) % photos.length);
      }

      if (event.key === "ArrowRight" && photos.length > 1) {
        setCurrentIndex((currentIndex + 1) % photos.length);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, photos.length, onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!photos.length) {
    return null;
  }

  const currentPhoto = photos[currentIndex];

  function showPrevious() {
    setCurrentIndex((currentIndex - 1 + photos.length) % photos.length);
  }

  function showNext() {
    setCurrentIndex((currentIndex + 1) % photos.length);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Review photo viewer"
    >
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center px-5 py-4">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
        >
          <X size={22} strokeWidth={1.8} />
        </button>

        {/* Reviewer identity */}
        <div className="ml-3 flex min-w-0 flex-1 items-center">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
            {review?.author?.avatar_url ? (
              <img
                src={review.author.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                {review?.author?.first_name?.[0]}
                {review?.author?.last_name?.[0]}
              </div>
            )}
          </div>

          <div className="ml-2.5 min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {review?.author?.first_name} {review?.author?.last_name}
            </p>

            <p className="mt-0.5 text-xs text-white/60">
              {relativeDate(review?.created_at)}
            </p>
          </div>
        </div>

        {/* Photo counter */}
        <div className="ml-3 rounded-full bg-black/45 px-3 py-1.5">
          <span className="text-xs font-semibold text-white">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      </div>

      {/* Photo viewer */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-16 py-20"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <img
          key={currentPhoto.id}
          src={currentPhoto.photo_url}
          alt={`Review photo ${currentIndex + 1}`}
          className="max-h-full max-w-full object-contain"
        />

        {/* Previous */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={showPrevious}
            aria-label="Previous review photo"
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 sm:left-6"
          >
            <ChevronLeft size={25} strokeWidth={1.8} />
          </button>
        )}

        {/* Next */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={showNext}
            aria-label="Next review photo"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 sm:right-6"
          >
            <ChevronRight size={25} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Pagination */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center rounded-full bg-black/35 px-3 py-2">
            {photos.map((photo, index) => (
              <button
                key={`${photo.id}-dot`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                aria-label={`View photo ${index + 1}`}
                className={`mx-1 h-1.5 w-1.5 cursor-pointer rounded-full transition-opacity ${
                  index === currentIndex
                    ? "bg-primary opacity-100"
                    : "bg-white opacity-40 hover:opacity-70"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function relativeDate(value) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );

  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}
