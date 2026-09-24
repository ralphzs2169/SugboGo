import MetricCardsSkeleton from "@/features/admin-panel/components/MetricCardsSkeleton";

/**
 * Displays the loading state for the business detail page.
 *
 * Mirrors the page's content structure while keeping static section titles
 * visible and skeletonizing only the dynamic business data.
 */
export default function BusinessDetailSkeleton() {
  const base = "animate-pulse rounded bg-skeleton";

  return (
    <div className="space-y-8">
      {/* Business identity */}
      <section>
        <div className="overflow-hidden rounded-xl border border-stroke bg-background">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,420px)_1fr]">
            {/* Photos and linked account */}
            <div className="p-4 sm:p-5">
              <div className={`${base} aspect-[4/3] w-full rounded-xl`} />

              <div className="mt-4 rounded-xl border border-stroke bg-surface-muted/40 p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Linked Account
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className={`${base} h-12 w-12 shrink-0 rounded-full`} />

                  <div className="min-w-0 flex-1">
                    <div className={`${base} h-4 w-32`} />
                    <div className={`${base} mt-2 h-3 w-44`} />
                  </div>
                </div>

                <div className={`${base} mt-3 h-9 w-full rounded-lg`} />
              </div>
            </div>

            {/* Business identity */}
            <div className="flex flex-col p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className={`${base} h-7 w-64 max-w-full`} />
                  <div className={`${base} mt-2 h-3 w-28`} />
                </div>

                <div className={`${base} h-9 w-9 shrink-0 rounded-lg`} />
              </div>

              {/* Classification */}
              <div className="mt-6 flex items-center gap-2">
                <div className={`${base} h-4 w-28`} />
                <div className="h-4 w-1 rounded bg-skeleton" />
                <div className={`${base} h-4 w-32`} />
              </div>

              {/* Specialty tags */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <div className={`${base} h-6 w-24 rounded-full`} />
                <div className={`${base} h-6 w-28 rounded-full`} />
                <div className={`${base} h-6 w-20 rounded-full`} />
              </div>

              {/* Description */}
              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  About this place
                </div>

                <div className={`${base} h-3 w-full max-w-xl`} />
                <div className={`${base} h-3 w-4/5 max-w-lg`} />
                <div className={`${base} h-3 w-3/5 max-w-md`} />
              </div>

              {/* Location, hours and contact */}
              <div className="mt-5 border-t border-stroke pt-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`${base} h-5 w-5 shrink-0 rounded`} />
                    <div className={`${base} h-4 w-48`} />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`${base} h-5 w-5 shrink-0 rounded`} />
                    <div className={`${base} h-4 w-36`} />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`${base} h-5 w-5 shrink-0 rounded`} />
                    <div className={`${base} h-4 w-52`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business engagement */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Engagement
        </h2>

        <MetricCardsSkeleton />
      </section>

      {/* Reviews & photos */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Reviews & Photos
        </h2>

        <div className="mt-4 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
          {/* Reviews */}
          <div className="flex lg:col-span-3">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-stroke bg-background">
              <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
                <div className="text-sm font-semibold text-text-primary">
                  Recent Reviews
                </div>

                <div className={`${base} h-4 w-20`} />
              </div>

              <div className="flex-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex gap-3 border-b border-stroke px-5 py-4"
                  >
                    <div
                      className={`${base} h-10 w-10 shrink-0 rounded-full`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`${base} h-4 w-28`} />
                        <div className={`${base} h-3 w-16`} />
                      </div>

                      <div className={`${base} mt-2 h-3 w-full`} />
                      <div className={`${base} mt-2 h-3 w-4/5`} />

                      <div className="mt-3 flex gap-3">
                        <div className={`${base} h-3 w-10`} />
                        <div className={`${base} h-3 w-14`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="flex lg:col-span-2">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-stroke bg-background">
              <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
                <div className="text-sm font-semibold text-text-primary">
                  Photo Gallery
                </div>

                <div className={`${base} h-4 w-16`} />
              </div>

              <div className="flex flex-1 gap-2 p-5">
                <div className={`${base} aspect-[4/3] flex-[2] rounded-lg`} />

                <div className="flex flex-1 flex-col gap-2">
                  <div className={`${base} min-h-0 flex-1 rounded-lg`} />
                  <div className={`${base} min-h-0 flex-1 rounded-lg`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Review insights */}
      <section className="overflow-hidden rounded-xl border border-stroke bg-background">
        <div className="border-b border-stroke bg-metric-header px-5 py-4">
          <div className={`${base} h-4 w-32`} />
          <div className={`${base} mt-2 h-3 w-64 max-w-full`} />
        </div>

        <div className="p-5">
          <div className={`${base} h-3 w-20`} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-stroke bg-surface p-4"
              >
                <div className={`${base} h-3 w-16`} />
                <div className={`${base} mt-3 h-7 w-14`} />
                <div className={`${base} mt-2 h-3 w-20`} />
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-stroke pt-5">
            <div className={`${base} h-3 w-40`} />
            <div className="mt-3 flex flex-wrap gap-2">
              <div className={`${base} h-7 w-32 rounded-full`} />
              <div className={`${base} h-7 w-24 rounded-full`} />
            </div>
          </div>

          <div className="mt-5 flex justify-between border-t border-stroke pt-5">
            <div className={`${base} h-4 w-52 max-w-[45%]`} />
            <div className={`${base} h-9 w-44 max-w-[45%] rounded-lg`} />
          </div>
        </div>
      </section>

      {/* Business application */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Business Application
        </h2>

        <div className="overflow-hidden rounded-xl border border-stroke bg-background">
          <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
            <div className="text-sm font-semibold text-text-primary">
              Application Summary
            </div>

            <div className={`${base} h-3 w-16`} />
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`${base} h-5 w-5 shrink-0 rounded`} />

                  <div className="min-w-0 flex-1">
                    <div className={`${base} h-3 w-32`} />
                    <div className={`${base} mt-2 h-4 w-24`} />
                    <div className={`${base} mt-2 h-3 w-20`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end border-t border-stroke pt-4">
              <div className={`${base} h-9 w-40 rounded-lg`} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
