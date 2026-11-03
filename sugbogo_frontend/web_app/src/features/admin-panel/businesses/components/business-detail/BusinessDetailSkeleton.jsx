import MetricCardsSkeleton from "@/features/admin-panel/components/MetricCardsSkeleton";
import { ChartNoAxesCombined, FileText, History, Image, MessageSquare } from "lucide-react";

/** Reserve the final page hierarchy during its first load, never during background refresh. */
export default function BusinessDetailSkeleton() {
  const line = "motion-safe:animate-pulse rounded bg-skeleton";
  return (
    <div
      className="space-y-8"
      role="status"
      aria-label="Loading business details"
    >
      {/* Primary identity and linked account */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="p-5">
          <div className={line + " aspect-[4/3] w-full rounded-xl"} />
          <div className={line + " mt-4 h-36 w-full"} />
        </div>
        <div className="space-y-5 p-6">
          <div className={line + " h-8 w-2/3"} />
          <div className={line + " h-4 w-1/3"} />
          <div className={line + " h-6 w-3/4"} />
          <div className={line + " h-20 w-full"} />
          <div className={line + " h-24 w-full"} />
        </div>
      </div>
      {/* Authoritative engagement cards */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Engagement
        </h2>
        <MetricCardsSkeleton count={4} />
      </section>
      {/* Review interpretation before bounded community content */}
      <div className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="border-b border-stroke bg-metric-header px-5 py-4 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <ChartNoAxesCombined size={16} aria-hidden="true" /> Review Insights
          </h2>
          <div className={line + " mt-2 h-3 w-64 max-w-full"} />
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className={line + " h-16 w-48 max-w-full"} />
          <div className={line + " h-4 w-full"} />
          <div className={line + " h-4 w-3/4"} />
          <div className="flex gap-3">
            <div className={line + " h-7 w-28 rounded-full"} />
            <div className={line + " h-7 w-24 rounded-full"} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {[
          { title: "Recent published reviews", icon: MessageSquare, width: "lg:col-span-3" },
          { title: "Photo Gallery", icon: Image, width: "lg:col-span-2" },
        ].map(({ title, icon: Icon, width }) => (
          <div key={title} className={`overflow-hidden rounded-xl border border-stroke bg-background ${width}`}>
            <h2 className="flex items-center gap-2 border-b border-stroke bg-metric-header px-5 py-4 text-sm font-semibold text-text-primary">
              <Icon size={16} aria-hidden="true" /> {title}
            </h2>
            <div className="space-y-4 p-5">
              <div className={line + " h-32 w-full"} />
              <div className={line + " h-4 w-2/3"} />
            </div>
          </div>
        ))}
      </div>
      {/* Protected administrative and application provenance */}
      {[
        { title: "Administrative History & Requests", icon: History },
        { title: "Business Application", icon: FileText },
      ].map(
        ({ title, icon: Icon }) => (
          <div
            key={title}
            className="overflow-hidden rounded-xl border border-stroke bg-background"
          >
            <h2 className="flex items-center gap-2 border-b border-stroke bg-metric-header px-5 py-4 text-sm font-semibold text-text-primary">
              <Icon size={16} aria-hidden="true" /> {title}
            </h2>
            <div className="p-5">
              {title === "Business Application" ? (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className="space-y-2">
                        <div className={line + " h-3 w-28"} />
                        <div className={line + " h-4 w-36 max-w-full"} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-end border-t border-stroke pt-4">
                    <div className={line + " h-5 w-40"} />
                  </div>
                </>
              ) : (
                <div className="space-y-4 border-l border-stroke pl-6">
                  <div className={line + " h-6 w-24 rounded-full"} />
                  <div className={line + " h-4 w-44"} />
                  <div className={line + " h-3 w-64 max-w-full"} />
                </div>
              )}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
