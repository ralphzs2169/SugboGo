import { Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import BusinessImage from "./BusinessImage";

import BusinessPhotoPreviewModal from "../../../business-applications/components/review/business-photos/BusinessPhotoPreviewModal";

const PREVIEW_COUNT = 3;

/**
 * Displays a compact visual preview of a business's photo gallery.
 *
 * Uses bounded full-width, paired, or featured-and-stacked tiles based on
 * photo count, with an overlay showing how many additional photos exist.
 * Clicking any thumbnail or "View all" opens the
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

  if (photos.length === 0) {
    return (
      <section className="w-full overflow-hidden rounded-xl border border-stroke bg-background">
        {/* Section header */}
        <div className="border-b border-stroke bg-metric-header px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <ImageIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
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
  const additionalPhotoCount = photos.length - PREVIEW_COUNT;

  return (
    <section className="w-full overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ImageIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
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

      {/* Bounded, count-aware photo preview */}
      <div className="p-5">
        <div
          className={
            "grid h-64 min-w-0 gap-2 sm:h-72 " +
            (previewPhotos.length === 1
              ? "grid-cols-1 grid-rows-1"
              : previewPhotos.length === 2
                ? "grid-cols-2 grid-rows-1"
                : "grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid-rows-2")
          }
        >
          {previewPhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={
                "relative min-h-0 min-w-0 cursor-pointer overflow-hidden rounded-lg bg-surface-muted " +
                (previewPhotos.length === 3 && index === 0 ? "row-span-2" : "")
              }
            >
              <BusinessImage
                src={photo.photo_url}
                alt={`${businessName ?? "Business"} photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {index === PREVIEW_COUNT - 1 && additionalPhotoCount > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-lg font-bold text-white">
                    +{additionalPhotoCount}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
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
          onSelectPhoto={setSelectedIndex}
        />
      )}
    </section>
  );
}
