/**
 * Displays a loading placeholder matching the application review SLA
 * information panel while analytics data is being loaded.
 */
export default function ApplicationReviewSlaInfoSkeleton() {
  const base = "animate-pulse rounded bg-skeleton";

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-info/20 bg-info/5">
      {/* SLA header */}
      <div className="flex items-center gap-3 p-4 sm:px-5">
        <div className={`${base} h-9 w-9 shrink-0 rounded-lg`} />

        <div className="min-w-0 flex-1 space-y-2">
          <div className={`${base} h-4 w-40`} />
          <div className={`${base} h-3 w-48`} />
        </div>

        <div className={`${base} h-4 w-4 shrink-0 rounded-full`} />
      </div>

      {/* SLA details */}
      <div className="border-t border-info/10 px-4 pb-5 pt-4 sm:px-5">
        <div className="space-y-2">
          <div className={`${base} h-4 w-full max-w-2xl`} />
          <div className={`${base} h-4 w-3/4 max-w-xl`} />
        </div>

        {/* Status thresholds */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <div className={`${base} h-2 w-2 rounded-full`} />
            <div className={`${base} h-3 w-12`} />
            <div className={`${base} h-3 w-24`} />
          </div>

          <div className="flex items-center gap-2">
            <div className={`${base} h-2 w-2 rounded-full`} />
            <div className={`${base} h-3 w-20`} />
            <div className={`${base} h-3 w-24`} />
          </div>

          <div className="flex items-center gap-2">
            <div className={`${base} h-2 w-2 rounded-full`} />
            <div className={`${base} h-3 w-14`} />
            <div className={`${base} h-3 w-24`} />
          </div>
        </div>
      </div>
    </div>
  );
}
