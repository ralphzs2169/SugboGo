import { useEffect, useState } from "react";

import BusinessPhotoGallery from "../../../business-applications/components/review/business-photos/BusinessPhotoGallery";
import BusinessPhotoPreviewModal from "../../../business-applications/components/review/business-photos/BusinessPhotoPreviewModal";

/**
 * Displays permanent photos registered for an approved business.
 *
 * Reuses the existing business photo gallery and focused preview experience,
 * including photo categories, navigation, and keyboard controls.
 */
export default function BusinessDetailPhotoGallery({ photos = [] }) {
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

  // Prevent background scrolling while the photo preview is open.
  useEffect(() => {
    if (!hasSelectedPhoto) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [hasSelectedPhoto]);

  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Photo Gallery
      </h2>

      <div className="rounded-xl border border-stroke bg-background p-5">
        {/* Photo gallery */}
        <BusinessPhotoGallery
          photos={photos}
          onPhotoSelect={setSelectedIndex}
        />
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
