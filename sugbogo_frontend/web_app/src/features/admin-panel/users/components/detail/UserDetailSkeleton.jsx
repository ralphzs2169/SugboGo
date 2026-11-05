const placeholder = "rounded bg-skeleton motion-safe:animate-pulse";
const card = "min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5";

/** Mirrors the dashboard-style section heading and supporting description. */
function SkeletonHeading({ description = true }) {
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`${placeholder} h-4 w-4 shrink-0`} />
        <div className={`${placeholder} h-4 w-40 max-w-full`} />
      </div>
      {description && <div className={`${placeholder} h-3 w-56 max-w-full`} />}
    </div>
  );
}

/** Reserves the profile and actions beside the role-relevant information and previews. */
export default function UserDetailSkeleton({ role }) {
  const merchant = role === "merchant";
  const fields = ["email", "joined"];

  if (role === "explorer" || merchant) {
    fields.push("reputation");
  }

  return (
    <div className="min-w-0 space-y-6 pb-12 sm:space-y-8" role="status" aria-label="Loading user details">
      <div aria-hidden="true" className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-5">
          <div className={card}>
          <SkeletonHeading description={false} />
          <div className="flex flex-col items-center gap-3 border-b border-stroke py-5">
            <div className={`${placeholder} h-20 w-20 shrink-0 rounded-full`} />
            <div className={`${placeholder} h-6 w-40 max-w-full`} />
            <div className={`${placeholder} h-3 w-20`} />
            <div className="flex gap-2">
              <div className={`${placeholder} h-6 w-20 rounded-full`} />
              <div className={`${placeholder} h-6 w-16 rounded-full`} />
            </div>
          </div>
          <div className="divide-y divide-stroke">
            {fields.map((field) => (
              <div key={field} className="space-y-2 py-4 last:pb-0">
                <div className={`${placeholder} h-3 w-20`} />
                <div className={`${placeholder} h-4 ${field === "email" ? "w-full" : "w-28"}`} />
                {(field === "joined" || field === "reputation") && (
                  <div className={`${placeholder} h-3 w-3/4`} />
                )}
                {field === "email" && (
                  <>
                    <div className={`${placeholder} h-3 w-24`} />
                    <div className={`${placeholder} h-3 w-3/4`} />
                  </>
                )}
              </div>
            ))}
          </div>
          </div>
          <div className={card}>
            <SkeletonHeading description={false} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className={`${placeholder} h-4 w-32 max-w-full`} />
                <div className={`${placeholder} h-3 w-3/4`} />
              </div>
              <div className={`${placeholder} h-8 w-24 rounded-lg`} />
            </div>
          </div>
        </div>
        <div className="min-w-0 space-y-5">
          {merchant && (
            <div className={card}>
              <SkeletonHeading />
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item} className={`${card} space-y-3`}>
                    <div className={`${placeholder} h-4 w-3/4`} />
                    <div className={`${placeholder} h-6 w-24 rounded-full`} />
                    <div className={`${placeholder} h-3 w-28`} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={card}>
            <SkeletonHeading />
            <div className={`grid gap-4 ${merchant ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>
              {Array.from({ length: merchant ? 4 : 3 }, (_, index) => (
                <div key={index} className="flex min-h-[165px] min-w-0 flex-col overflow-hidden rounded-xl border border-stroke bg-background">
                  <div className="border-b border-stroke bg-metric-header px-4 py-3">
                    <div className={`${placeholder} h-3 w-3/4`} />
                  </div>
                  <div className="flex flex-1 flex-col justify-end gap-3 p-5">
                    <div className={`${placeholder} h-8 w-12`} />
                    <div className={`${placeholder} h-3 w-full`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {["activity", "history"].map((section) => (
            <div key={section} className={card}>
              <SkeletonHeading />
              <div className="divide-y divide-stroke">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex items-start gap-3 py-3">
                    <div className={`${placeholder} h-8 w-8 shrink-0 rounded-lg`} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className={`${placeholder} h-4 w-36 max-w-full`} />
                        <div className={`${placeholder} h-3 w-28 max-w-full`} />
                      </div>
                      <div className={`${placeholder} h-3 w-2/3`} />
                      <div className={`${placeholder} h-3 w-20`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
