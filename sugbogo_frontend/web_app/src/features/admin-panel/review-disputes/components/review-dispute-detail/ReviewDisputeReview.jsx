import { useState } from "react";
import { Flag, Quote, ThumbsUp } from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import ReviewPhotoViewerModal from "@/shared/components/modals/ReviewPhotoViewerModal";
import { formatRelativeDate } from "@/shared/utils/dateUtils";

const MAX_REVIEW_PHOTO_PREVIEW = 4;

/**
 * Displays the complete disputed review and its merchant response,
 * including review activity and attached photos.
 */
export default function ReviewDisputeReview({ review }) {
  const [photoViewerIndex, setPhotoViewerIndex] = useState(null);

  const author = review?.author;
  const photos = review?.photos ?? [];
  const merchantReply = review?.reply;
  const reportSummary = review?.report_summary ?? [];

  const reviewerName = author
    ? `${author.first_name || ""} ${author.last_name || ""}`.trim()
    : "Unknown explorer";

  const totalReports =
    review?.report_count ??
    reportSummary.reduce((sum, report) => sum + report.count, 0);

  const visiblePhotos = photos.slice(0, MAX_REVIEW_PHOTO_PREVIEW);
  const remainingPhotoCount = photos.length - MAX_REVIEW_PHOTO_PREVIEW;

  return (
    <>
      <div>
        {/* Original review heading */}
        <div className="flex items-center gap-2">
          <Quote className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} />

          <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            Original Review
          </h2>
        </div>
        <div className="mt-4">
          {/* Reviewer identity */}
          <div className="flex items-center gap-3">
            <UserAvatar avatarUrl={author?.avatar_url} size="md" />

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {reviewerName}
              </p>

              <p className="text-xs text-text-secondary">
                {formatRelativeDate(review?.created_at)}
              </p>
            </div>
          </div>

          {/* Review content */}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-text-primary">
            "{review?.text || "No review content available."}"
          </p>

          {/* Review photos */}
          {photos.length > 0 && (
            <div className="mt-4">
              {/* <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />

                <span>
                  {photos.length} photo
                  {photos.length > 1 ? "s" : ""}
                </span>
              </div> */}

              <div className="flex flex-wrap gap-2">
                {visiblePhotos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPhotoViewerIndex(index)}
                    aria-label={`View review photo ${index + 1}`}
                    className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-lg bg-surface-muted transition-opacity hover:opacity-90"
                  >
                    <img
                      src={photo.photo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />

                    {/* Remaining photo count */}
                    {index === MAX_REVIEW_PHOTO_PREVIEW - 1 &&
                      remainingPhotoCount > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                          <span className="text-sm font-semibold text-white">
                            +{remainingPhotoCount}
                          </span>
                        </div>
                      )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Review activity */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} />
              {review?.like_count ?? 0}
            </span>

            {totalReports > 0 && (
              <span className="flex items-center gap-1 font-semibold text-danger">
                <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
                {totalReports} reported
              </span>
            )}
          </div>
        </div>

        {/* Merchant response */}
        <div className="mt-6 border-l-2 border-primary bg-surface-muted/40 px-4 py-3.5">
          {merchantReply ? (
            <div>
              {/* Response heading */}
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  Merchant Response
                </span>

                <span className="shrink-0 text-xs text-text-secondary">
                  {formatRelativeDate(merchantReply.created_at)}
                </span>
              </div>

              {/* Response content */}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">
                {merchantReply.text || "No response content available."}
              </p>
            </div>
          ) : (
            /* No response state */
            <p className="text-sm text-text-secondary">
              Merchant hasn't responded to this review.
            </p>
          )}
        </div>
      </div>

      {/* Review photo viewer */}
      {photoViewerIndex !== null && (
        <ReviewPhotoViewerModal
          photos={photos}
          initialIndex={photoViewerIndex}
          review={review}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
    </>
  );
}
