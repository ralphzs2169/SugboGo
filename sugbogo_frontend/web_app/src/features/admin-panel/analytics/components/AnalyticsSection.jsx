import { useId } from "react";
import { LoaderCircle } from "lucide-react";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import AnalyticsDataNotice from "./AnalyticsDataNotice";
import AnalyticsReportSkeleton from "./AnalyticsReportSkeleton";

/** Frames an independent report with explicit data states and retained refresh content.
 * Fetching and notifications remain owned by the consuming hook and page.
 */
export default function AnalyticsSection({
  title,
  description,
  controls,
  action,
  children,
  footer,
  isLoading = false,
  isFetching = false,
  hasData = false,
  error,
  onRetry,
  errorMessage = "Unable to load this report. Please try again.",
  isEmpty = false,
  emptyMessage = "No records were found for this selection.",
  unavailable = false,
  unavailableMessage = "This report's data source is currently unavailable.",
  partialNotice,
  skeleton = <AnalyticsReportSkeleton />,
}) {
  const headingId = useId();
  const descriptionId = useId();
  let content;

  if (isLoading && !hasData) {
    content = skeleton;
  } else if (error && !hasData) {
    content = (
      <DataErrorState
        compact
        title="Unable to load report"
        message={errorMessage}
        onRetry={onRetry}
        retrying={isFetching}
        retryLabel="Retry"
      />
    );
  } else if (unavailable) {
    content = <div className="py-6"><AnalyticsDataNotice kind="unavailable">{unavailableMessage}</AnalyticsDataNotice></div>;
  } else if (isEmpty) {
    content = <p className="py-10 text-center text-sm text-text-secondary">{emptyMessage}</p>;
  } else {
    content = children;
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={isLoading || isFetching}
      className="min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-6"
    >
      {/* Report heading and independent controls */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={headingId} className="text-base font-semibold text-text-primary">{title}</h2>
          {description && <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p>}
        </div>
        <div className="flex max-w-full flex-wrap items-end gap-3">
          {controls}
          {action}
          {isFetching && hasData && (
            <span role="status" className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
              Refreshing
            </span>
          )}
        </div>
      </header>

      {/* Source limitations and recoverable refresh errors */}
      {error && hasData && (
        <div role="alert" className="mb-4 space-y-2">
          <AnalyticsDataNotice kind="unavailable" title="Refresh failed">{errorMessage} Previously loaded data is shown.</AnalyticsDataNotice>
          {onRetry && <Button variant="secondary" loading={isFetching} onClick={onRetry}>Retry</Button>}
        </div>
      )}
      {partialNotice && !unavailable && !isLoading && !(error && !hasData) && (
        <div className="mb-4"><AnalyticsDataNotice kind="partial">{partialNotice}</AnalyticsDataNotice></div>
      )}

      {/* Report body and optional context */}
      <div className="min-w-0">{content}</div>
      {footer && <footer className="mt-4 border-t border-stroke pt-4 text-sm text-text-secondary">{footer}</footer>}
    </section>
  );
}
