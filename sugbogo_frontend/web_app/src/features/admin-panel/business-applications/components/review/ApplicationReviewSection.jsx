/**
 * Provides the shared visual structure for sections on the
 * merchant application review page.
 *
 * Keeps section headers, optional icons, completion indicators,
 * and content spacing consistent across the review experience.
 */
export default function ApplicationReviewSection({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <section className="rounded-xl border border-stroke bg-background p-6">
      {/* Section header */}
      <div className="flex items-start gap-2 border-b border-stroke pb-5">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Icon size={25} strokeWidth={2} />
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold leading-8 text-text-primary">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          )}
        </div>
      </div>

      {/* Section content */}
      <div className="pt-6">{children}</div>
    </section>
  );
}
