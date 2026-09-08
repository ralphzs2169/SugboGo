/**
 * Displays the loading state for the review dispute detail page.
 *
 * Mirrors the dispute case, evidence, history, and moderation footer structure
 * while keeping static section labels visible and skeletonizing dynamic data.
 */
export default function ReviewDisputeDetailSkeleton() {
  const base = "animate-pulse rounded bg-skeleton";

  return (
    <>
      <div className="space-y-6 pb-12">
        {/* Dispute case */}
        <section className="overflow-hidden rounded-xl border border-stroke bg-background">
          {/* Case header */}
          <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Dispute Case
            </h2>

            <div className={`${base} h-6 w-20 rounded-full`} />
          </div>

          {/* Case content */}
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Review and dispute request */}
            <div className="p-6 lg:col-span-3 lg:border-r lg:border-stroke">
              {/* Original review */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                  Original Review
                </div>

                {/* Reviewer identity */}
                <div className="mt-4 flex items-center gap-3">
                  <div className={`${base} h-7 w-7 shrink-0 rounded-full`} />

                  <div className="min-w-0">
                    <div className={`${base} h-4 w-32`} />
                    <div className={`${base} mt-1.5 h-3 w-20`} />
                  </div>
                </div>

                {/* Review content */}
                <div className="mt-4 space-y-2">
                  <div className={`${base} h-4 w-full`} />
                  <div className={`${base} h-4 w-11/12`} />
                  <div className={`${base} h-4 w-3/4`} />
                </div>

                {/* Review photos */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className={`${base} h-20 w-20 rounded-lg`}
                    />
                  ))}
                </div>

                {/* Review activity */}
                <div className="mt-3 flex items-center gap-3">
                  <div className={`${base} h-3 w-10`} />
                  <div className={`${base} h-3 w-16`} />
                </div>

                {/* Merchant response */}
                <div className="mt-6 border-l-2 border-stroke bg-surface-muted/40 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                      Merchant Response
                    </div>

                    <div className={`${base} h-3 w-16`} />
                  </div>

                  <div className={`${base} mt-3 h-3 w-full`} />
                  <div className={`${base} mt-2 h-3 w-4/5`} />
                </div>
              </div>

              {/* Dispute relationship */}
              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-stroke" />

                <span className="text-xs font-semibold text-text-secondary">
                  ↓ disputed because
                </span>

                <div className="h-px flex-1 bg-stroke" />
              </div>

              {/* Dispute request */}
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                  Dispute Request
                </div>

                <div className="mt-5 space-y-5">
                  {/* Reason */}
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">
                      Reason
                    </p>

                    <div className={`${base} mt-2 h-4 w-40`} />
                  </div>

                  {/* Merchant explanation */}
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">
                      Merchant Explanation
                    </p>

                    <div className="mt-2 rounded-lg border border-stroke bg-surface-secondary/50 px-4 py-3.5">
                      <div className={`${base} h-3 w-full`} />
                      <div className={`${base} mt-2 h-3 w-11/12`} />
                      <div className={`${base} mt-2 h-3 w-3/4`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Supporting case context */}
            <div className="lg:col-span-2">
              {/* Case info */}
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                  Case Info
                </div>

                {/* Business identity */}
                <div className="mt-5 flex items-start gap-3">
                  <div className={`${base} h-12 w-12 shrink-0 rounded-lg`} />

                  <div className="min-w-0 flex-1">
                    <div className={`${base} h-4 w-36`} />

                    <div className="mt-2 flex items-center gap-2">
                      <div className={`${base} h-3 w-3 rounded`} />
                      <div className={`${base} h-3 w-40`} />
                    </div>
                  </div>
                </div>

                {/* Specialty tags */}
                <div className="mt-3 flex flex-wrap gap-1">
                  <div className={`${base} h-5 w-20 rounded-full`} />
                  <div className={`${base} h-5 w-24 rounded-full`} />
                  <div className={`${base} h-5 w-16 rounded-full`} />
                </div>

                {/* Case metadata */}
                <dl className="mt-6 space-y-3.5">
                  {["Merchant", "Filed", "Attempt", "Evidence"].map((label) => (
                    <div key={label} className="flex gap-4 text-sm">
                      <dt className="w-20 shrink-0 font-semibold text-text-secondary">
                        {label}
                      </dt>

                      <dd className="min-w-0 flex-1">
                        <div className={`${base} h-4 w-28`} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Explorer reports */}
              <div className="border-t border-stroke p-6">
                <div className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                  Explorer Reports
                </div>

                <div className="mt-5">
                  {/* Report summary */}
                  <div className="flex items-end justify-between border-b border-stroke pb-4">
                    <div>
                      <p className="text-xs font-semibold text-text-secondary">
                        Total Reports
                      </p>

                      <div className={`${base} mt-2 h-7 w-10`} />
                    </div>

                    <div className={`${base} h-4 w-4 rounded`} />
                  </div>

                  {/* Report breakdown */}
                  <div className="mt-4">
                    <p className="mb-2.5 text-xs font-semibold text-text-secondary">
                      Report Reasons
                    </p>

                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`${base} h-1.5 w-1.5 rounded-full`}
                            />
                            <div className={`${base} h-3 w-28`} />
                          </div>

                          <div className={`${base} h-3 w-5`} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Evidence */}
        <section className="overflow-hidden rounded-xl border border-stroke bg-background">
          {/* Evidence header */}
          <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Evidence
            </h2>

            <div className={`${base} h-3 w-12`} />
          </div>

          {/* Evidence content */}
          <div className="p-5">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-stroke px-3 py-3 sm:w-64"
                >
                  <div className={`${base} h-12 w-12 shrink-0 rounded-md`} />

                  <div className="min-w-0 flex-1">
                    <div className={`${base} h-4 w-28`} />
                    <div className={`${base} mt-2 h-3 w-16`} />
                  </div>

                  <div className={`${base} h-4 w-4 shrink-0 rounded`} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Previous disputes */}
        <section className="overflow-hidden rounded-xl border border-stroke bg-background">
          {/* History header */}
          <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Previous Disputes
            </h2>

            <div className={`${base} h-3 w-16`} />
          </div>

          {/* Previous attempts */}
          <div>
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-5 border-b border-stroke px-5 py-4 last:border-b-0"
              >
                {/* Attempt information */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`${base} h-4 w-20`} />
                    <div className={`${base} h-6 w-20 rounded-full`} />
                  </div>

                  <div className={`${base} mt-2 h-4 w-36`} />
                  <div className={`${base} mt-2 h-3 w-28`} />
                </div>

                {/* Historical navigation */}
                <div className={`${base} h-4 w-24`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Moderation decision footer */}
      <section
        className="
          fixed bottom-0 left-0 right-0 z-30
          border-t border-stroke
          bg-background/95
          px-6 py-4
          backdrop-blur
          lg:left-[var(--admin-sidebar-width)]
        "
      >
        <div className="flex items-center justify-between gap-4">
          {/* Decision context */}
          <div className="hidden min-w-0 sm:block">
            <h2 className="text-sm font-semibold text-text-primary">
              Review Decision
            </h2>

            <p className="mt-0.5 text-xs text-text-secondary">
              Review the submitted dispute and determine the appropriate
              outcome.
            </p>
          </div>

          {/* Decision actions */}
          <div className="flex w-full justify-end gap-3 sm:w-auto">
            <div className={`${base} h-9 w-24 rounded-lg`} />
            <div className={`${base} h-9 w-32 rounded-lg`} />
          </div>
        </div>
      </section>
    </>
  );
}
