import DataErrorState from "@/shared/components/errors/DataErrorState";

/** Isolate one Dashboard request while retaining its loaded content during refresh and retry. */
export default function DashboardQuerySection({ query, label, children }) {
  const hasData = query.data !== undefined;

  return (
    <section aria-label={label} aria-busy={query.isFetching} className="min-w-0">
      {/* Independent initial load and persistent recovery */}
      {query.isLoading && !hasData && (
        <p role="status" className="py-4 text-sm text-text-secondary">
          Loading {label.toLowerCase()}…
        </p>
      )}
      {query.error && (
        <DataErrorState
          compact
          title={`Unable to load ${label.toLowerCase()}`}
          message={hasData
            ? "The refresh failed. Previously loaded data remains visible."
            : "Please try again."}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
          retryLabel="Retry"
        />
      )}

      {/* Existing presentation receives successful data without refresh-time blanking */}
      {hasData && children(query.data)}
      {hasData && query.isFetching && (
        <p role="status" className="mt-2 text-xs text-text-secondary">
          Refreshing {label.toLowerCase()}…
        </p>
      )}
    </section>
  );
}
