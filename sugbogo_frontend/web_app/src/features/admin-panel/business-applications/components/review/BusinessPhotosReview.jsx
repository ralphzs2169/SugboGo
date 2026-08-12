import { useEffect, useState } from "react";
import { Images } from "lucide-react";

import ApplicationReviewSection from "./ApplicationReviewSection";
import BusinessPhotoGallery from "./business-photos/BusinessPhotoGallery";
import BusinessPhotoPreviewModal from "./business-photos/BusinessPhotoPreviewModal";
import ApplicationReviewFeedback from "./ApplicationReviewFeedback";
/**
 * Displays business photos submitted as visual evidence for the
 * merchant application.
 *
 * Coordinates the photo gallery and focused preview experience while
 * keeping navigation and keyboard interactions contained to the review flow.
 */
export default function BusinessPhotosReview({
  photos = [],
  feedback,
  isResubmission = false,
}) {
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

  // Prevent background page scrolling while the preview is open.
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
    <>
      {/* Business photos section */}
      <ApplicationReviewSection
        icon={Images}
        title="Business Photos"
        description="Review the photos submitted as visual evidence of the business."
      >
        <ApplicationReviewFeedback
          feedback={feedback}
          isResubmission={isResubmission}
        />
        <BusinessPhotoGallery
          photos={photos}
          onPhotoSelect={setSelectedIndex}
        />
      </ApplicationReviewSection>

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
    </>
  );
}
