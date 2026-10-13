const skeleton = "animate-pulse bg-skeleton";

export default function ModerationQueueSkeleton({ label }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="divide-y divide-stroke">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} aria-hidden="true" className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className={`${skeleton} h-8 w-8 shrink-0 rounded-full`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className={`${skeleton} h-4 w-32 rounded`} />
                <div className={`${skeleton} h-3 w-16 rounded`} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`${skeleton} h-6 w-6 shrink-0 rounded-md`} />
                <div className={`${skeleton} h-3 w-28 rounded`} />
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className={`${skeleton} h-3 w-full rounded`} />
            <div className={`${skeleton} h-3 w-3/4 rounded`} />
          </div>
          <div className="mt-3 flex gap-2">
            <div className={`${skeleton} h-5 w-24 rounded-full`} />
            <div className={`${skeleton} h-5 w-16 rounded-full`} />
          </div>
        </div>
      ))}
    </div>
  );
}
