import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Provides a focused preview of a submitted business photo.
 *
 * Supports previous/next navigation, photo metadata, backdrop dismissal,
 * and closing the preview through the dedicated close control.
 */
export default function BusinessPhotoPreviewModal({
  photo,
  currentIndex,
  totalPhotos,
  onClose,
  onPrevious,
  onNext,
}) {
  if (!photo) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Business photo preview"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal content */}
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface shadow-2xl">
        {/* Modal header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stroke px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold capitalize text-text-primary">
              {photo.category}
            </p>

            <p className="mt-0.5 truncate text-xs text-text-secondary">
              {photo.file_name || "Business photo"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close photo preview"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>

        {/* Image preview */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-background p-4 sm:p-8">
          <img
            src={photo.photo_url}
            alt={photo.file_name || "Business photo"}
            className="max-h-[65vh] max-w-full object-contain"
          />

          {/* Previous photo */}
          {totalPhotos > 1 && (
            <button
              type="button"
              onClick={onPrevious}
              className="absolute left-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 sm:left-5"
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} strokeWidth={1.8} />
            </button>
          )}

          {/* Next photo */}
          {totalPhotos > 1 && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 sm:right-5"
              aria-label="Next photo"
            >
              <ChevronRight size={22} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-stroke px-4 py-3 sm:px-5">
          <p className="text-xs text-text-secondary">
            Photo {currentIndex + 1} of {totalPhotos}
          </p>

          <p className="hidden max-w-[60%] truncate text-xs text-text-secondary sm:block">
            {photo.file_name || "Business photo"}
          </p>
        </div>
      </div>
    </div>
  );
}
