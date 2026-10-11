import { ArrowDown, ArrowRight } from "lucide-react";

/**
 * Displays a comparison between previously captured and proposed values.
 *
 * Uses neutral styling to emphasize the proposed value, with a circular
 * directional indicator that adapts to mobile and desktop layouts.
 */
export default function ReviewComparison({
  title,
  previous,
  proposed,
  status,
  previousLabel = "At submission",
  children,
}) {
  return (
    <div className="border-b border-stroke py-4 first:pt-0 last:border-b-0 last:pb-0">
      {/* Comparison heading */}
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>

      {/* Previous and proposed values */}
      <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* Previous value */}
        <div className="min-w-0 rounded-xl bg-surface p-5">
          <p className="text-xs font-medium text-text-secondary">
            {previousLabel}
          </p>

          <div className="mt-3 break-words text-lg font-medium leading-7 text-text-primary">
            {previous || "Not provided"}
          </div>
        </div>

        {/* Directional indicator */}
        <div className="flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-background shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
            <ArrowDown
              size={18}
              className="text-text-secondary sm:hidden"
              aria-hidden="true"
            />

            <ArrowRight
              size={18}
              className="hidden text-text-secondary sm:block"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Proposed or approved value */}
        <div className="min-w-0 rounded-xl border border-stroke bg-background p-5">
          <p className="text-xs font-semibold text-text-secondary">
            {status === "approved" ? "Approved" : "Requested"}
          </p>

          <div className="mt-3 break-words text-xl font-bold leading-7 text-text-primary">
            {proposed || "Not provided"}
          </div>
        </div>
      </div>

      {/* Additional comparison details */}
      {children}
    </div>
  );
}
