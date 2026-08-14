/**
 * Displays skeleton KPI cards while merchant application analytics
 * are being loaded, matching the dimensions and layout of MetricCard.
 */
export default function ApplicationMetricsSkeleton() {
  const base = "animate-pulse rounded bg-skeleton";

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-[165px] flex-col justify-between rounded-lg border border-stroke bg-background p-6 shadow-sm"
        >
          {/* Card title */}
          <div className={`${base} h-3 w-28`} />

          {/* KPI value, footer, and sparkline */}
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* KPI value */}
              <div className={`${base} h-9 w-20`} />

              {/* Trend/footer */}
              <div className="mt-2 flex items-center gap-2">
                <div className={`${base} h-3 w-4`} />
                <div className={`${base} h-3 w-20`} />
              </div>
            </div>

            {/* Historical sparkline */}
            <div className={`${base} h-14 w-20 shrink-0 rounded`} />
          </div>
        </div>
      ))}
    </div>
  );
}
