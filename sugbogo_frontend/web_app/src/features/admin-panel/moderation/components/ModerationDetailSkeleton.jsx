const skeleton = "animate-pulse bg-skeleton";

export default function ModerationDetailSkeleton({ label, sections, showDecision = false }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="flex min-h-[620px] flex-col">
      <span className="sr-only">{label}</span>
      <div className="min-h-0 flex-1 space-y-6 p-5 sm:p-6">
        <div aria-hidden="true" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className={`${skeleton} h-6 w-36 rounded`} />
            <div className={`${skeleton} h-6 w-24 rounded-full`} />
          </div>
          <div className="flex items-center gap-3">
            <div className={`${skeleton} h-6 w-6 rounded-full`} />
            <div className={`${skeleton} h-4 w-40 rounded`} />
          </div>
          <div className="flex items-center gap-3">
            <div className={`${skeleton} h-6 w-6 rounded-md`} />
            <div className={`${skeleton} h-4 w-48 rounded`} />
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <div className={`${skeleton} h-3 w-36 rounded`} />
            <div className={`${skeleton} h-3 w-32 rounded`} />
          </div>
        </div>
        <section className="rounded-xl border border-stroke bg-background p-5">
          <h2 className="text-sm font-semibold text-text-primary">Review Content</h2>
          <div aria-hidden="true" className="mt-4 space-y-2">
            <div className={`${skeleton} h-4 w-full rounded`} />
            <div className={`${skeleton} h-4 w-11/12 rounded`} />
            <div className={`${skeleton} h-4 w-2/3 rounded`} />
            <div className={`${skeleton} mt-4 h-20 w-24 rounded-lg`} />
          </div>
        </section>
        {sections.map((section) => (
          <section key={section} className="rounded-xl border border-stroke bg-background p-5">
            <h2 className="text-sm font-semibold text-text-primary">{section}</h2>
            <div aria-hidden="true" className="mt-4 space-y-3">
              <div className={`${skeleton} h-4 w-4/5 rounded`} />
              <div className={`${skeleton} h-4 w-2/3 rounded`} />
              <div className={`${skeleton} h-4 w-1/2 rounded`} />
            </div>
          </section>
        ))}
      </div>
      {showDecision && (
        <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4 border-t border-stroke bg-background px-5 py-4 sm:px-6">
          <div className={`${skeleton} h-4 w-32 rounded`} />
          <div className="flex gap-2">
            <div className={`${skeleton} h-9 w-28 rounded-lg`} />
            <div className={`${skeleton} h-9 w-36 rounded-lg`} />
          </div>
        </div>
      )}
    </div>
  );
}
