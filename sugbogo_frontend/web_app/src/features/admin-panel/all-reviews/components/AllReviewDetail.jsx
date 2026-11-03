import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import UserAvatar from "@/shared/components/UserAvatar";
import ReviewPhotoViewerModal from "@/shared/components/modals/ReviewPhotoViewerModal";
import BusinessImage from "../../businesses/components/business-detail/BusinessImage";
import useBusinessMediaFocus from "../../businesses/hooks/useBusinessMediaFocus";
import { allReviewModerationDestinations } from "../utils/allReviewModeration";
import { reviewAuthorName } from "../utils/allReviewPresentation";
import AllReviewReports from "./AllReviewReports";
import AllReviewHistory from "./AllReviewHistory";
import ReviewDate from "./ReviewDate";
import ReviewStateBadge from "./ReviewStateBadge";

const OUTCOMES = {
  safe: "No content flagged by the automated check",
  flagged: "Flagged for review by the automated check",
  provider_failure: "Automated check unavailable",
};
const SENTIMENTS = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

/** Inspect the exact detail payload while leaving all decisions in Moderation. */
export default function AllReviewDetail({ review }) {
  const [photoIndex, setPhotoIndex] = useState(null);
  const photoDialog = useRef(null);
  useBusinessMediaFocus(photoDialog, photoIndex !== null);
  const photos = review.photos ?? [];
  const business = review.business;
  const author = review.author;
  const destinations = allReviewModerationDestinations(review.moderation_links);
  const sentiment = review.sentiment;
  const moderation = review.moderation;
  const timestamps = [
    ["Submitted", review.submitted_at],
    ["Published", review.published_at],
    ["Edited", review.edited_at],
    ["Updated", review.updated_at],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">
          Review #{review.id}
        </p>
        <ReviewStateBadge status={review.status} />
      </div>

      {destinations.length > 0 && (
        <section
          aria-label="Moderation destinations"
          className="rounded-lg border border-stroke bg-surface p-4"
        >
          <p className="mb-3 text-xs text-text-secondary">
            Inspect decisions and pending work in the existing Moderation
            workspace.
          </p>
          <div className="flex flex-wrap gap-2">
            {destinations.map((destination) => (
              <Link
                key={destination.key}
                to={destination.to}
                aria-label={`Open in Moderation: ${destination.label}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stroke-strong bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-info"
              >
                <span>
                  Open in Moderation
                  <span className="block text-xs font-normal text-text-secondary">
                    {destination.label}
                  </span>
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Review content">
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          Review
        </h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
          {review.text || "No written review."}
        </p>
        {photos.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-text-primary">
              Review photos ({photos.length})
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={`View review photo ${index + 1}`}
                  onClick={() => setPhotoIndex(index)}
                  className="cursor-pointer overflow-hidden rounded-lg border border-stroke text-left hover:bg-interaction-hover focus-visible:outline-2 focus-visible:outline-info"
                >
                  <BusinessImage
                    src={photo.photo_url}
                    alt={`Review photo ${index + 1}`}
                    className="aspect-[4/3] w-full"
                  />
                  <span className="block px-2 py-1.5 text-xs text-text-secondary">
                    Photo {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-text-secondary">
            Text-only review · No photos attached
          </p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-stroke bg-surface p-4">
        {timestamps.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 text-xs text-text-secondary">{label}</dt>
            <dd>
              <ReviewDate value={value} />
            </dd>
          </div>
        ))}
      </dl>

      <section
        aria-label="Reviewer identity"
        className="border-t border-stroke pt-5"
      >
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          Reviewer
        </h3>
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            avatarUrl={author?.avatar_url}
            avatarKey={author?.avatar_key}
            size="lg"
          />
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-text-primary">
              {reviewAuthorName(author)}
            </p>
            {author?.email && (
              <p className="mt-1 break-all text-sm text-text-secondary">
                {author.email}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Business identity"
        className="border-t border-stroke pt-5"
      >
        <h3 className="mb-3 text-base font-semibold text-text-primary">
          Business
        </h3>
        <div className="flex min-w-0 items-center gap-3">
          <BusinessImage
            src={business?.cover_photo_url}
            alt=""
            fallback=""
            className="h-16 w-16 shrink-0 rounded-lg border border-stroke"
          />
          <div className="min-w-0 space-y-1">
            <p className="break-words text-sm font-semibold text-text-primary">
              {business?.name || "Business unavailable"}
            </p>
            {business?.category_name && (
              <p className="break-words text-sm text-text-secondary">
                {business.category_name}
              </p>
            )}
            {business?.cluster_name && (
              <p className="break-words text-xs text-text-secondary">
                {business.cluster_name}
              </p>
            )}
          </div>
        </div>
      </section>

      <AllReviewReports review={review} />

      <section
        aria-label="Stored automated analysis"
        className="rounded-lg border border-stroke bg-surface p-4"
      >
        <h3 className="text-sm font-semibold text-text-primary">
          Stored automated analysis
        </h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-text-secondary">Sentiment</dt>
            <dd className="mt-1 text-text-primary">
              {SENTIMENTS[sentiment?.label] || "Not available"}
              {Number.isFinite(sentiment?.score) && (
                <span className="text-text-secondary">
                  {" "}
                  · Score {sentiment.score.toFixed(2)}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">
              Automated moderation
            </dt>
            <dd className="mt-1 text-text-primary">
              {OUTCOMES[moderation?.outcome] || "No outcome recorded"}
            </dd>
          </div>
          {moderation?.checked_at && (
            <div>
              <dt className="mb-1 text-xs text-text-secondary">Checked</dt>
              <dd>
                <ReviewDate value={moderation.checked_at} />
              </dd>
            </div>
          )}
        </dl>
        {moderation?.provider_unavailable && (
          <p className="mt-3 text-xs text-text-secondary">
            The stored automated check was unavailable or incomplete.
          </p>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Stored analysis may predate a manual decision. The current review
          status is shown above.
        </p>
      </section>

      <AllReviewHistory history={review.history ?? []} />

      {photoIndex !== null && (
        <ReviewPhotoViewerModal
          key={`${review.id}-${photoIndex}`}
          photos={photos}
          initialIndex={photoIndex}
          review={{ ...review, created_at: review.submitted_at }}
          dialogRef={photoDialog}
          onClose={() => setPhotoIndex(null)}
        />
      )}
    </div>
  );
}
