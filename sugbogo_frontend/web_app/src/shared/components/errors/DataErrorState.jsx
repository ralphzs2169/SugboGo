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
}) {
  return (
    <div
      className={
        fullHeight
          ? "flex min-h-[520px] items-center justify-center border border-stroke bg-background px-6 py-14"
          : "flex justify-center rounded-xl border border-stroke bg-background px-6 py-14"
      }
    >
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-text-secondary" />

        <h2 className="mt-4 text-lg font-semibold text-text-primary">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {message}
        </p>

        {/* Retry action */}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
