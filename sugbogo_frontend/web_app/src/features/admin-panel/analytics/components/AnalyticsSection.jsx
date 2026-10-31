import { useId } from "react";
import { Info, LoaderCircle } from "lucide-react";
import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import AnalyticsDataNotice from "./AnalyticsDataNotice";
import AnalyticsReportSkeleton from "./AnalyticsReportSkeleton";
import AnalyticsDisclosure from "./AnalyticsDisclosure";

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
  onAbout,
  aboutDisabled = false,
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
  framed = true,
  compactHeader = false,
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
    content = (
      <div className="space-y-3 py-6">
        <AnalyticsDataNotice kind="unavailable">{unavailableMessage}</AnalyticsDataNotice>
        {onRetry && <Button variant="secondary" loading={isFetching} onClick={onRetry}>Retry</Button>}
      </div>
    );
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
      className={framed ? "min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5" : "min-w-0"}
    >
      {/* Report heading and independent controls */}
      <header className={`${compactHeader ? "mb-2" : "mb-3"} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0 flex-1 basis-36">
          <div className="flex items-center gap-1">
            <h2 id={headingId} className="text-base font-semibold text-text-primary">{title}</h2>
            {onAbout && <button type="button" aria-label={`About ${title}`} aria-haspopup="dialog" disabled={aboutDisabled} onClick={onAbout} className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50">
              <Info aria-hidden="true" className="h-4 w-4" />
            </button>}
          </div>
          {description && <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>}
        </div>
        <div className="flex max-w-full flex-wrap items-end gap-2">
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
        <div className="mb-2 flex justify-end"><AnalyticsDisclosure label="Partial coverage" inline>{partialNotice}</AnalyticsDisclosure></div>
      )}

      {/* Report body and optional context */}
      <div className="min-w-0">{content}</div>
      {footer && <footer className="mt-3 text-sm text-text-secondary">{footer}</footer>}
    </section>
  );
}
