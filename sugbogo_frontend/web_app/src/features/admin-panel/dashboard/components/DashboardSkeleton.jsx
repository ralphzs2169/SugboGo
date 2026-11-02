/** Mirror Dashboard card geometry while preserving theme-aware, reduced-motion loading feedback. */
export default function DashboardSkeleton({ label, variant = "default" }) {
  const metric = variant === "inventory" || variant === "activity";

  return (
    <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className={metric || variant === "queues" ? "min-w-0" : "py-3"}>
      {/* Metric placeholders follow the loaded header, value, and secondary detail. */}
      {metric ? (
        <div aria-hidden="true" className="flex min-h-[165px] min-w-0 flex-col overflow-hidden rounded-xl border border-stroke bg-background">
          <div className="flex items-center justify-between gap-3 border-b border-stroke bg-metric-header px-4 py-3">
            <div className="h-3 w-2/5 rounded bg-skeleton motion-safe:animate-pulse" />
            <div className="h-5 w-5 shrink-0 rounded bg-skeleton motion-safe:animate-pulse" />
          </div>
          <div className="flex flex-1 items-end justify-between gap-3 p-5">
            <div className="min-w-0 flex-1 space-y-3 motion-safe:animate-pulse">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <div className="h-9 w-14 rounded bg-skeleton" />
                {variant === "activity" && <div className="h-3 w-20 max-w-full rounded bg-skeleton" />}
              </div>
              <div className="h-3 w-24 max-w-full rounded bg-skeleton" />
            </div>
            {variant === "inventory" && (
              <div className="h-20 w-20 shrink-0 self-center rounded-full border-[8px] border-skeleton motion-safe:animate-pulse" />
            )}
          </div>
        </div>
      ) : variant === "queues" ? (
        <div aria-hidden="true" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {/* Queue cards retain their icon/title row, count, label, and context. */}
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex min-w-0 flex-col rounded-xl border border-stroke bg-background p-3">
              <div className="motion-safe:animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-skeleton" />
                  <div className="h-4 min-w-0 flex-1 rounded bg-skeleton" />
                  <div className="h-4 w-4 shrink-0 rounded bg-skeleton" />
                </div>
                <div className="mt-2 h-8 w-12 rounded bg-skeleton" />
                <div className="mt-0.5 h-4 w-3/5 rounded bg-skeleton" />
                <div className="mt-2 h-4 w-4/5 rounded bg-skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Other Dashboard sections retain their existing compact placeholders. */
        <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
          <div className="h-4 w-2/5 rounded bg-skeleton" />
          <div className="h-9 rounded bg-skeleton" />
          <div className="h-9 rounded bg-skeleton" />
          <div className="h-9 w-4/5 rounded bg-skeleton" />
        </div>
      )}
    </div>
  );
}
