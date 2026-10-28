/** Reserves report space while initial data loads without implying observed values. */
export default function AnalyticsReportSkeleton({ kind = "chart" }) {
  return (
    <div role="status" aria-label="Loading report" className={kind === "table" ? "min-h-[620px] p-4" : "min-h-64 p-4 sm:min-h-72"}>
      {/* Stable report placeholder */}
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-4 w-1/3 rounded bg-skeleton" />
        {kind === "table" ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-8 w-full rounded bg-skeleton" />
            ))}
          </div>
        ) : (
          <div className="h-48 rounded-lg bg-skeleton sm:h-56" />
        )}
      </div>
    </div>
  );
}
