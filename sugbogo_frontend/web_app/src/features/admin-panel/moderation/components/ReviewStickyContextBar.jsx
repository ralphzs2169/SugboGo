import { ReviewStatusBadge } from "./ReviewIdentityHeader";

export default function ReviewStickyContextBar({ review, visible, statusVariant }) {
  const authorName = [review.author?.first_name, review.author?.last_name]
    .filter(Boolean)
    .join(" ");
  const context = [authorName, review.business?.name].filter(Boolean).join(" · ");

  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div
        aria-hidden={!visible}
        className={`flex h-14 items-center justify-between gap-3 border-b border-stroke bg-background/80 px-5 backdrop-blur-md lg:px-6 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            Review #{review.id}
          </p>
          {context && (
            <p className="truncate text-xs text-text-secondary">{context}</p>
          )}
        </div>
        <ReviewStatusBadge status={review.status} variant={statusVariant} />
      </div>
    </div>
  );
}
