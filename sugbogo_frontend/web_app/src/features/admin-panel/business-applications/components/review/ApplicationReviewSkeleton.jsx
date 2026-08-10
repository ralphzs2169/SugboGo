/**
 * Provides a loading representation of the merchant application review page.
 *
 * Mirrors the actual review workspace structure so administrators can
 * understand the page layout while application data is being fetched.
 */
export default function BusinessApplicationReviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Application header */}
      <section className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="h-1 w-full bg-skeleton" />

        <div className="p-6">
          {/* Application identity and status */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Skeleton className="h-4 w-28" />

              <Skeleton className="mt-2 h-8 w-64 max-w-[70vw]" />

              <Skeleton className="mt-2 h-4 w-48" />
            </div>

            <Skeleton className="h-7 w-28 rounded-full" />
          </div>

          {/* Key application facts */}
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-stroke pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonMeta />
            <SkeletonMeta />
            <SkeletonMeta />
            <SkeletonMeta />
          </div>
        </div>
      </section>

      {/* Business identity */}
      <ReviewSectionSkeleton>
        {/* Business information */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField className="md:col-span-2" />
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
        </div>

        {/* Representative information */}
        <SkeletonSubsection titleWidth="w-28" fields={2} />

        {/* Business classification */}
        <div className="mt-8 border-t border-stroke pt-6">
          <Skeleton className="h-4 w-40" />

          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <SkeletonField />
            <SkeletonField />
          </div>

          {/* Specialty tags */}
          <div className="mt-6">
            <Skeleton className="h-3 w-28" />

            <div className="mt-2 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </ReviewSectionSkeleton>

      {/* Business location */}
      <ReviewSectionSkeleton>
        {/* Address information */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField className="md:col-span-2" />
        </div>

        {/* Map and landmarks */}
        <div className="mt-8 border-t border-stroke pt-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
            {/* Map */}
            <Skeleton className="min-h-[360px] w-full rounded-lg" />

            {/* Nearby landmarks */}
            <div>
              <Skeleton className="h-4 w-36" />

              <div className="mt-4 overflow-hidden rounded-lg border border-stroke">
                <SkeletonLandmark />
                <SkeletonLandmark />
                <SkeletonLandmark />
              </div>
            </div>
          </div>
        </div>
      </ReviewSectionSkeleton>

      {/* Operating hours */}
      <ReviewSectionSkeleton>
        <div className="overflow-hidden rounded-lg border border-stroke">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-6 border-b border-stroke px-4 py-4 last:border-b-0"
            >
              {/* Day and hours */}
              <div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-4 w-28" />
              </div>

              {/* Open/closed status */}
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </ReviewSectionSkeleton>

      {/* Business photos */}
      <ReviewSectionSkeleton>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-stroke bg-surface"
            >
              {/* Photo thumbnail */}
              <Skeleton className="aspect-square w-full rounded-none" />

              {/* Photo metadata */}
              <div className="border-t border-stroke px-3 py-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-3 w-32 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </ReviewSectionSkeleton>

      {/* Verification documents */}
      <ReviewSectionSkeleton>
        <div className="overflow-hidden rounded-lg border border-stroke">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b border-stroke px-4 py-4 last:border-b-0"
            >
              {/* Document preview */}
              <Skeleton className="h-20 w-16 shrink-0 rounded" />

              {/* Document information */}
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="mt-2 h-3 w-48 max-w-full" />
              </div>

              {/* View action */}
              <Skeleton className="h-9 w-16 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </ReviewSectionSkeleton>

      {/* Review decision */}
      <section className="rounded-xl border border-stroke bg-surface p-6">
        <Skeleton className="h-5 w-32" />

        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </section>
    </div>
  );
}

/**
 * Renders a reusable animated placeholder for review-page content.
 */
function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-skeleton ${className}`}
    />
  );
}

/**
 * Renders the placeholder structure used by application metadata items.
 */
function SkeletonMeta() {
  return (
    <div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-4 w-28 max-w-full" />
    </div>
  );
}

/**
 * Renders the placeholder structure used by application review fields.
 */
function SkeletonField({ className = "" }) {
  return (
    <div className={className}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-4 w-36 max-w-full" />
    </div>
  );
}

/**
 * Renders the shared heading and content structure of a review section.
 */
function ReviewSectionSkeleton({ children }) {
  return (
    <section className="rounded-xl border border-stroke bg-background p-6">
      {/* Section heading */}
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      {/* Section content */}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * Renders the placeholder structure for a subsection within a review section.
 */
function SkeletonSubsection({ fields = 2, titleWidth = "w-32" }) {
  return (
    <div className="mt-8 border-t border-stroke pt-6">
      <Skeleton className={`h-4 ${titleWidth}`} />

      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => (
          <SkeletonField key={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders the placeholder structure for a submitted nearby landmark.
 */
function SkeletonLandmark() {
  return (
    <div className="flex items-start gap-3 border-b border-stroke px-4 py-4 last:border-b-0">
      <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />

      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-32 max-w-full" />
        <Skeleton className="mt-2 h-3 w-44 max-w-full" />
      </div>
    </div>
  );
}
