/** Keep initial Dashboard loading compact using the existing Analytics skeleton treatment. */
export default function DashboardSkeleton({ label }) {
  return (
    <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className="py-3">
      {/* Theme-aware placeholders contain no observed values */}
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        <div className="h-4 w-2/5 rounded bg-skeleton" />
        <div className="h-9 rounded bg-skeleton" />
        <div className="h-9 rounded bg-skeleton" />
        <div className="h-9 w-4/5 rounded bg-skeleton" />
      </div>
    </div>
  );
}
