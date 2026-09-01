import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import BusinessPhotoPreviewModal from "../../../business-applications/components/review/business-photos/BusinessPhotoPreviewModal";

const PREVIEW_COUNT = 3;

/**
 * Displays a compact visual preview of a business's photo gallery.
 *
 * Mirrors the Explorer mobile app's photo preview layout — one featured
 * photo alongside two supporting photos, with an overlay showing how many
 * additional photos exist. Clicking any thumbnail or "View all" opens the
 * full photo preview modal with keyboard navigation.
 */
export default function BusinessPhotosPreview({ photos = [], businessName }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const hasSelectedPhoto =
    selectedIndex !== null && photos[selectedIndex] !== undefined;

  const selectedPhoto = hasSelectedPhoto ? photos[selectedIndex] : null;

  function closePreview() {
    setSelectedIndex(null);
  }

  function showPreviousPhoto() {
    if (!photos.length || selectedIndex === null) {
      return;
    }

    setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
  }

  function showNextPhoto() {
    if (!photos.length || selectedIndex === null) {
      return;
    }

    setSelectedIndex((selectedIndex + 1) % photos.length);
  }

  // Keyboard navigation for the focused photo preview.
  useEffect(() => {
    if (!hasSelectedPhoto) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closePreview();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasSelectedPhoto, selectedIndex]);

  if (photos.length === 0) {
    return (
      <section className="overflow-hidden rounded-xl border border-stroke bg-background">
        {/* Section header */}
        <div className="border-b border-stroke bg-metric-header px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Photo Gallery
          </h2>
        </div>

        {/* Empty state */}
        <div className="flex min-h-40 flex-1 flex-col items-center justify-center px-5 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <ImageIcon
              size={20}
              strokeWidth={1.75}
              className="text-text-secondary"
            />
          </div>

          <p className="mt-3 text-sm font-medium text-text-primary">
            No photos yet
          </p>

          <p className="mt-1 max-w-xs text-xs text-text-secondary">
            Business photos will appear here once they have been added.
          </p>
        </div>
      </section>
    );
  }

  const previewPhotos = photos.slice(0, PREVIEW_COUNT);
  const featuredPhoto = previewPhotos[0];
  const supportingPhotos = previewPhotos.slice(1);
  const additionalPhotoCount = photos.length - PREVIEW_COUNT;

  return (
    <section className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Photo Gallery
        </h2>

        <button
          type="button"
          onClick={() => setSelectedIndex(0)}
          className="cursor-pointer text-sm font-semibold text-primary hover:underline"
        >
          View all ({photos.length})
        </button>
      </div>

      {/* Photo gallery preview */}
      <div className="flex flex-1 gap-2 p-5">
        {/* Featured photo */}
        <button
          type="button"
          onClick={() => setSelectedIndex(0)}
          className="aspect-[4/3] flex-[2] cursor-pointer overflow-hidden rounded-lg bg-surface-muted"
        >
          <img
            src={featuredPhoto.photo_url}
            alt={`${businessName ?? "Business"} photo 1`}
            className="h-full w-full object-cover"
          />
        </button>

        {/* Supporting photos */}
        {supportingPhotos.length > 0 && (
          <div className="flex flex-1 flex-col gap-2">
            {supportingPhotos.map((photo, index) => {
              const photoIndex = index + 1;
              const isLastPreview = index === supportingPhotos.length - 1;
              const hasMorePhotos = additionalPhotoCount > 0;

              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedIndex(photoIndex)}
                  className="relative min-h-0 flex-1 cursor-pointer overflow-hidden rounded-lg bg-surface-muted"
                >
                  <img
                    src={photo.photo_url}
                    alt={`${businessName ?? "Business"} photo ${
                      photoIndex + 1
                    }`}
                    className="h-full w-full object-cover"
                  />

                  {/* More photos overlay */}
                  {isLastPreview && hasMorePhotos && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-lg font-bold text-white">
                        +{additionalPhotoCount}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Focused photo preview */}
      {hasSelectedPhoto && (
        <BusinessPhotoPreviewModal
          photo={selectedPhoto}
          currentIndex={selectedIndex}
          totalPhotos={photos.length}
          onClose={closePreview}
          onPrevious={showPreviousPhoto}
          onNext={showNextPhoto}
        />
      )}
    </section>
  );
}
