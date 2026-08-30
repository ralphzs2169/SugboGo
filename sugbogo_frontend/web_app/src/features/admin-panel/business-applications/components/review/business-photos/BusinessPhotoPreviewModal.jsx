import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Provides a fullscreen, focused viewer for a submitted business photo.
 *
 * Displays the current photo against a dark backdrop with reviewer-style
 * navigation, a photo counter, and pagination controls while preventing
 * background page scrolling.
 */
export default function BusinessPhotoPreviewModal({
  photo,
  currentIndex,
  totalPhotos,
  onClose,
  onPrevious,
  onNext,
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [photo?.photo_url]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && totalPhotos > 1) {
        onPrevious();
        return;
      }

      if (event.key === "ArrowRight" && totalPhotos > 1) {
        onNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onPrevious, onNext, totalPhotos]);

  if (!photo) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Business photo viewer"
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

        {/* Photo information */}
        <div className="ml-3 min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize text-white">
            {photo.category + " Photo" || "Business photo"}
          </p>

          <p className="mt-0.5 truncate text-xs text-white/60">
            {photo.file_name || "Business photo"}
          </p>
        </div>

        {/* Photo counter */}
        <div className="ml-3 rounded-full bg-black/45 px-3 py-1.5">
          <span className="text-xs font-semibold text-white">
            {currentIndex + 1} / {totalPhotos}
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
        {/* Loading placeholder */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}

        {/* Photo */}
        {!hasError && (
          <img
            key={photo.id}
            src={photo.photo_url}
            alt={photo.file_name || "Business photo"}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        {/* Failed image */}
        {hasError && (
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-white">
              Unable to load photo
            </p>

            <p className="mt-1 text-xs text-white/60">
              This photo could not be displayed.
            </p>
          </div>
        )}

        {/* Previous */}
        {totalPhotos > 1 && (
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous business photo"
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 sm:left-6"
          >
            <ChevronLeft size={25} strokeWidth={1.8} />
          </button>
        )}

        {/* Next */}
        {totalPhotos > 1 && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next business photo"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 sm:right-6"
          >
            <ChevronRight size={25} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Pagination */}
      {totalPhotos > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center rounded-full bg-black/35 px-3 py-2">
            {Array.from({ length: totalPhotos }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (index === currentIndex) {
                    return;
                  }

                  if (index > currentIndex) {
                    onNext();
                  } else {
                    onPrevious();
                  }
                }}
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
