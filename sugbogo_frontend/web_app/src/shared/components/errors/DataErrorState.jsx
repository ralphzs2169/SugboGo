import { AlertCircle, LoaderCircle } from "lucide-react";

/**
 * Displays a consistent error state when requested data cannot be loaded.
 *
 * Provides a clear message and optional retry action for recoverable
 * loading failures.
 */
export default function DataErrorState({
  title = "Something went wrong",
  message = "The requested information could not be loaded.",
  onRetry,
  fullHeight = false,
  compact = false,
  framed = false,
  retrying = false,
  retryLabel = "Try Again",
  retainedData = false,
  refreshLabel,
  detectOffline = false,
}) {
  const offline = detectOffline && typeof window !== "undefined" && window.navigator.onLine === false;
  const Heading = compact ? "h3" : "h2";

  if (retainedData) {
    return (
      <div role="alert" aria-label={refreshLabel} className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-muted px-3 py-2 text-sm leading-relaxed">
        {/* Retained content warning and its request-specific recovery action */}
        <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
        <div className="min-w-0 flex-1 basis-40 break-words">
          <p className="font-medium text-text-primary">Refresh failed{refreshLabel && <span className="font-normal"> · {refreshLabel}</span>}</p>
          <p className="text-text-secondary">Showing previously loaded data.</p>
        </div>
        {onRetry && (
          <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying}
            className="inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60">
            {retrying && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />}
            {retrying ? "Retrying..." : retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={
        compact
          ? `flex justify-center px-4 py-6${framed ? " rounded-xl border border-stroke bg-background" : ""}`
          : fullHeight
          ? "flex min-h-[520px] items-center justify-center border border-stroke bg-background px-6 py-14"
          : "flex justify-center rounded-xl border border-stroke bg-background px-6 py-14"
      }
    >
      <div className="max-w-md text-center">
        {/* Error explanation */}
        <AlertCircle aria-hidden="true" className={`mx-auto text-text-secondary ${compact ? "h-6 w-6" : "h-10 w-10"}`} />

        <Heading className="mt-4 text-lg font-semibold text-text-primary">
          {offline ? "You're offline" : title}
        </Heading>

        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {offline ? "Check your connection and try again." : message}
        </p>

        {/* Retry action */}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying} aria-busy={retrying}
            className="mt-5 inline-flex items-center justify-center gap-2 cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying && <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />}
            {retrying ? "Retrying..." : retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
