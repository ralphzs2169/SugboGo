import { ReviewStatusBadge } from "./ReviewIdentityHeader";

export default function ReviewStickyContextBar({ review, visible, statusVariant }) {
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div
        aria-hidden={!visible}
        className={`flex h-12 items-center justify-between gap-3 border-b border-stroke bg-background/80 px-5 backdrop-blur-md lg:px-6 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <span className="truncate text-sm font-semibold text-text-primary">
          Review #{review.id}
        </span>
        <ReviewStatusBadge status={review.status} variant={statusVariant} />
      </div>
    </div>
  );
}
