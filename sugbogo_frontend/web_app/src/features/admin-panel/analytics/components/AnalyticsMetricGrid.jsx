import MetricCardsSkeleton from "../../components/MetricCardsSkeleton";

/** Arranges reusable KPI cards in one, two or four columns and reuses Admin skeletons. */
export default function AnalyticsMetricGrid({ children, isLoading = false, skeletonCount = 4 }) {
  return (
    <div className="min-w-0">
      {/* Initial placeholders or responsive metric content */}
      {isLoading ? (
        <div role="status" aria-label="Loading metrics"><MetricCardsSkeleton count={skeletonCount} /></div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      )}
    </div>
  );
}
