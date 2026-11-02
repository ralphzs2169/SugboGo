import MetricCardsSkeleton from "@/features/admin-panel/components/MetricCardsSkeleton";

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
      <div className="rounded-xl border border-stroke bg-background p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          Review Insights
        </h2>
        <div className={line + " mt-4 h-14 w-1/3"} />
        <div className={line + " mt-5 h-20 w-full"} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={line + " h-72 lg:col-span-3"} />
        <div className={line + " h-72 lg:col-span-2"} />
      </div>
      {/* Protected administrative and application provenance */}
      {["Administrative History & Requests", "Business Application"].map(
        (title) => (
          <div
            key={title}
            className="rounded-xl border border-stroke bg-background p-5"
          >
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            <div className={line + " mt-4 h-20 w-full"} />
          </div>
        ),
      )}
    </div>
  );
}
