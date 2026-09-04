/**
 * Displays the loading structure for the review dispute detail page while
 * the dispute data is being fetched.
 */
export default function ReviewDisputeDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Case summary skeleton */}
      <section>
        <div className="mb-4 flex justify-end">
          <div className="h-6 w-20 animate-pulse rounded-full bg-surface-secondary" />
        </div>

        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-5">
          <div className="space-y-6 p-6 lg:col-span-3 lg:border-r lg:border-stroke">
            <div>
              <div className="h-3 w-28 animate-pulse rounded bg-surface-secondary" />
              <div className="mt-5 h-4 w-48 animate-pulse rounded bg-surface-secondary" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-surface-secondary" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-surface-secondary" />
            </div>

            <div className="h-px bg-stroke" />

            <div>
              <div className="h-3 w-32 animate-pulse rounded bg-surface-secondary" />

              <div className="mt-5 space-y-4">
                <div>
                  <div className="h-3 w-16 animate-pulse rounded bg-surface-secondary" />
                  <div className="mt-2 h-4 w-32 animate-pulse rounded bg-surface-secondary" />
                </div>

                <div>
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-secondary" />
                  <div className="mt-2 h-4 w-full animate-pulse rounded bg-surface-secondary" />
                  <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-surface-secondary" />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="space-y-4 p-6">
              <div className="h-3 w-20 animate-pulse rounded bg-surface-secondary" />

              <div className="space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex gap-4">
                    <div className="h-3 w-16 animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-28 animate-pulse rounded bg-surface-secondary" />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-stroke p-6">
              <div className="h-3 w-32 animate-pulse rounded bg-surface-secondary" />

              <div className="mt-5 space-y-3">
                <div className="h-4 w-40 animate-pulse rounded bg-surface-secondary" />
                <div className="h-4 w-28 animate-pulse rounded bg-surface-secondary" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-secondary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence skeleton */}
      <section>
        <div className="mb-4 h-3 w-20 animate-pulse rounded bg-surface-secondary" />

        <div className="flex gap-3 rounded-xl border border-stroke bg-background p-5">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-16 w-40 animate-pulse rounded-lg bg-surface-secondary"
            />
          ))}
        </div>
      </section>

      {/* Decision skeleton */}
      <section>
        <div className="h-32 animate-pulse rounded-xl border border-stroke bg-surface-secondary" />
      </section>
    </div>
  );
}
