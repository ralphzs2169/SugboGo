import DataErrorState from "@/shared/components/errors/DataErrorState";
import DashboardSkeleton from "./DashboardSkeleton";

/** Isolate one Dashboard request while retaining its loaded content during refresh and retry. */
export default function DashboardQuerySection({
  query,
  label,
  description,
  children,
  action,
  informationAction,
  framed = true,
  headingAs = "h2",
  headerVisible = true,
  icon: Icon,
}) {
  const hasData = query.data !== undefined;
  const Heading = headingAs;

  return (
    <section
      aria-label={label}
      aria-busy={query.isFetching}
      className={
        framed
          ? "min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5"
          : "min-w-0"
      }
    >
      {/* Match Analytics headings and keep independent refresh feedback unobtrusive */}
      {headerVisible && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <Heading
                className={`${headingAs === "h3" ? "text-sm" : "text-base"} ${Icon ? "flex items-center gap-2" : ""} font-semibold text-text-primary`}
              >
                {Icon && (
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                )}
                {label}
              </Heading>
              {informationAction}
            </div>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                {description}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      {/* Independent initial load and persistent recovery */}
      {query.isLoading && !hasData && <DashboardSkeleton label={label} />}
      {query.error && (
        <DataErrorState
          compact
          title={`Unable to load ${label.toLowerCase()}`}
          message={
            hasData
              ? "The refresh failed. Previously loaded data remains visible."
              : "Please try again."
          }
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
          retryLabel="Retry"
        />
      )}

      {/* Successful content remains visible during refresh and recoverable errors */}
      {hasData && children(query.data)}
      {hasData && query.isFetching && (
        <p role="status" className="mt-2 text-xs text-text-secondary">
          Refreshing {label.toLowerCase()}…
        </p>
      )}
    </section>
  );
}
