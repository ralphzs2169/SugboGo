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
  headerAction,
  children,
}) {
  return (
    <section className="min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-6">
      {/* Section header */}
      <div className="flex items-start gap-3 border-b border-stroke pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            {Icon && (
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            )}
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
          )}
        </div>
        {headerAction}
      </div>

      {/* Section content */}
      <div className="pt-5">{children}</div>
    </section>
  );
}
