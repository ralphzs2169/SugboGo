/** Render a theme-aware placeholder that respects reduced-motion preferences. */
function Placeholder({ className = "" }) {
  return <div className={`rounded bg-skeleton motion-safe:animate-pulse ${className}`} />;
}

/** Reserve the captured/proposed comparison layout for each request type. */
function ComparisonSkeleton({ requestType }) {
  return (
    <div className="mt-5">
      <Placeholder className="mb-3 h-4 w-32 max-w-full" />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        {["previous", "direction", "proposed"].map((part) => {
          if (part === "direction") {
            return <Placeholder key={part} className="mx-auto h-10 w-10 shrink-0 rounded-full" />;
          }
          return (
            <div
              key={part}
              className={`min-w-0 rounded-xl p-5 ${part === "previous" ? "bg-surface" : "border border-stroke bg-background shadow-sm"}`}
            >
              <Placeholder className="h-3 w-24 max-w-full" />
              <Placeholder className="mt-3 h-7 w-4/5" />
              {requestType !== "business_name" && <Placeholder className="mt-2 h-3 w-3/5" />}
            </div>
          );
        })}
      </div>
      {requestType === "classification" && (
        <div className="mt-6 space-y-3 border-t border-stroke pt-6">
          <Placeholder className="h-4 w-36 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {["w-24", "w-32", "w-20"].map((width) => (
              <Placeholder key={width} className={`h-7 rounded-full ${width}`} />
            ))}
          </div>
        </div>
      )}
      {requestType === "location" && (
        <div className="mt-6 border-t border-stroke pt-6">
          <Placeholder className="h-4 w-32 max-w-full" />
          <Placeholder className="mt-2 h-3 w-4/5" />
          <Placeholder className="mt-4 h-72 w-full rounded-lg border border-stroke sm:h-80" />
        </div>
      )}
    </div>
  );
}

/** Match the unified update-request case while its status and content are loading. */
export default function UpdateRequestDetailSkeleton({ requestType = "business_name" }) {
  const labels = {
    business_name: "Loading business name update request",
    classification: "Loading classification update request",
    location: "Loading location update request",
  };
  const label = labels[requestType] ?? "Loading update request";

  return (
    <div role="status" aria-label={label} aria-busy="true" className="w-full min-w-0 pb-36 sm:pb-28">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
          <Placeholder className="h-5 w-40 max-w-full" />
          <Placeholder className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
          <div className="min-w-0 p-5 sm:p-6 xl:border-r xl:border-stroke">
            <Placeholder className="h-4 w-40 max-w-full" />
            <ComparisonSkeleton requestType={requestType} />
            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-stroke" />
              <Placeholder className="h-3 w-32" />
              <div className="h-px flex-1 bg-stroke" />
            </div>
            <Placeholder className="h-4 w-36 max-w-full" />
            <Placeholder className="mt-5 h-3 w-40 max-w-full" />
            <div className="mt-2 space-y-3 rounded-lg bg-surface p-4">
              <Placeholder className="h-4 w-5" />
              <Placeholder className="h-3 w-full" />
              <Placeholder className="h-3 w-11/12" />
              <Placeholder className="h-3 w-2/3" />
            </div>
          </div>
          <div className="min-w-0 border-t border-stroke xl:border-t-0">
            <div className="p-5 sm:p-6">
              <Placeholder className="h-4 w-40 max-w-full" />
              <div className="mt-5 space-y-4">
                {["request", "submitted"].map((field) => (
                  <div key={field} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                    <Placeholder className="h-4 w-16" />
                    <Placeholder className="h-4 w-4/5" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-stroke p-5 sm:p-6">
              <Placeholder className="h-4 w-40 max-w-full" />
              {["business", "merchant"].map((identity) => (
                <div key={identity} className="mt-5">
                  <Placeholder className="mb-3 h-3 w-20" />
                  <div className="flex min-w-0 items-center gap-3">
                    <Placeholder className={`h-12 w-12 shrink-0 ${identity === "merchant" ? "rounded-full" : "rounded-lg"}`} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Placeholder className="h-4 w-3/4" />
                      <Placeholder className="h-3 w-4/5" />
                      <Placeholder className="h-3 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4 border-t border-stroke p-5 sm:p-6">
              <Placeholder className="h-4 w-36 max-w-full" />
              {["first", "second", "third", "fourth"].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Placeholder className="h-4 w-4 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Placeholder className="h-3 w-full" />
                    <Placeholder className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
