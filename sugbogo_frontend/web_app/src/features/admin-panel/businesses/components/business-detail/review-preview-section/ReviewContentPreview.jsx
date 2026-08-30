import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

import ReviewPreviewModal from "./ReviewPreviewModal";

const MAX_PREVIEW_PHOTOS = 3;

/**
 * Displays a compact review preview with truncated text and photo thumbnails.
 *
 * Long review text can be expanded through the full review modal, while
 * attached photos remain directly accessible regardless of review length.
 */
export default function ReviewContentPreview({ review }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasLongContent = review.text?.length > 160;
  const photos = review.photos ?? [];
  const previewPhotos = photos.slice(0, MAX_PREVIEW_PHOTOS);
  const remainingPhotoCount = photos.length - MAX_PREVIEW_PHOTOS;

  return (
    <>
      {/* Review text preview */}
      <div className="mt-1">
        <p
          className={`text-sm leading-6 text-text-secondary ${
            hasLongContent ? "line-clamp-2" : ""
          }`}
        >
          {review.text}
        </p>

        {hasLongContent && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-1 cursor-pointer text-xs font-semibold text-primary hover:underline"
          >
            Read full review
          </button>
        )}
      </div>

      {/* Review photo preview */}
      {photos.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          {previewPhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label={`View review photo ${index + 1}`}
              className="relative h-14 w-14 cursor-pointer overflow-hidden rounded-lg bg-surface-muted transition-opacity hover:opacity-90"
            >
              <img
                src={photo.photo_url}
                alt=""
                className="h-full w-full object-cover"
              />

              {/* Remaining photo count */}
              {index === MAX_PREVIEW_PHOTOS - 1 && remainingPhotoCount > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <span className="text-xs font-semibold text-white">
                    +{remainingPhotoCount}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Full review modal */}
      {isModalOpen && (
        <ReviewPreviewModal
          review={review}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
