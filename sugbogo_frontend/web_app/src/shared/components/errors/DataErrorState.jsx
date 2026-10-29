import { AlertCircle } from "lucide-react";

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
  retrying = false,
  retryLabel = "Try Again",
}) {
  const Heading = compact ? "h3" : "h2";

  return (
    <div
      role="alert"
      className={
        compact
          ? "flex justify-center px-4 py-6"
          : fullHeight
          ? "flex min-h-[520px] items-center justify-center border border-stroke bg-background px-6 py-14"
          : "flex justify-center rounded-xl border border-stroke bg-background px-6 py-14"
      }
    >
      <div className="max-w-md text-center">
        {/* Error explanation */}
        <AlertCircle aria-hidden="true" className={`mx-auto text-text-secondary ${compact ? "h-6 w-6" : "h-10 w-10"}`} />

        <Heading className="mt-4 text-lg font-semibold text-text-primary">
          {title}
        </Heading>

        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {message}
        </p>

        {/* Retry action */}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-5 cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? "Retrying..." : retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
