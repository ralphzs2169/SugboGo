import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import BusinessImage from "../../../../businesses/components/business-detail/BusinessImage";
import useBusinessMediaFocus from "../../../../businesses/hooks/useBusinessMediaFocus";

/** Inspect original business photos with one keyboard owner, guarded images and restored focus. */
export default function BusinessPhotoPreviewModal({
  photo,
  currentIndex,
  totalPhotos,
  onClose,
  onPrevious,
  onNext,
  onSelectPhoto,
}) {
  const dialog = useRef(null);
  const hasPhoto = Boolean(photo);
  useBusinessMediaFocus(dialog, hasPhoto);
  useEffect(() => {
    if (!hasPhoto) return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [hasPhoto]);
  useEffect(() => {
    if (!hasPhoto) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && totalPhotos > 1) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && totalPhotos > 1) {
        event.preventDefault();
        onNext();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [hasPhoto, onClose, onPrevious, onNext, totalPhotos]);
  if (!photo) return null;
  const controlClass =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white";
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col bg-black outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Business photo viewer"
    >
      {/* Photo identity and close action */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className={controlClass}
        >
          <X size={22} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize text-white">
            {photo.category ? photo.category + " photo" : "Business photo"}
          </p>
          <p className="truncate text-xs text-white/60">
            {photo.file_name || "Business photo"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-white" role="status">
          {currentIndex + 1} / {totalPhotos}
        </p>
      </div>
      {/* Original image and sequential inspection */}
      <div className="relative min-h-0 flex-1 px-14 pb-6 sm:px-20">
        <BusinessImage
          src={photo.photo_url}
          alt={photo.file_name || "Business photo"}
          fit="contain"
          transparent
          className="h-full w-full"
        />
        {totalPhotos > 1 && (
          <>
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous business photo"
              className={
                controlClass +
                " absolute left-1 top-1/2 -translate-y-1/2 sm:left-4"
              }
            >
              <ChevronLeft size={25} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next business photo"
              className={
                controlClass +
                " absolute right-1 top-1/2 -translate-y-1/2 sm:right-4"
              }
            >
              <ChevronRight size={25} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {/* Direct navigation only when the caller supplies an exact index action */}
      {onSelectPhoto && totalPhotos > 1 && (
        <div className="flex max-h-24 shrink-0 flex-wrap justify-center gap-1 overflow-y-auto px-4 pb-4">
          {Array.from({ length: totalPhotos }, (_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => onSelectPhoto(index)}
              aria-label={"View photo " + (index + 1)}
              aria-current={index === currentIndex ? "true" : undefined}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-white"
            >
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (index === currentIndex ? "bg-primary" : "bg-white/40")
                }
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
