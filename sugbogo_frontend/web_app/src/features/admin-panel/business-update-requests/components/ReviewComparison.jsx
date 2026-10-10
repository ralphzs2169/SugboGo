import { ArrowRight } from "lucide-react";

/** A compact, accessible comparison of two captured values. */
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
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="min-w-0 rounded-lg bg-surface p-4">
          <p className="text-xs font-medium text-text-secondary">
            {previousLabel}
          </p>
          <div className="mt-1 break-words text-sm text-text-primary">
            {previous || "Not provided"}
          </div>
        </div>
        <ArrowRight
          className="hidden h-4 w-4 text-text-secondary sm:block"
          aria-hidden="true"
        />
        <div className="min-w-0 rounded-lg bg-primary/5 p-4">
          <p className="text-xs font-medium text-text-secondary">
            {status === "approved" ? "Approved" : "Requested"}
          </p>
          <div className="mt-1 break-words text-sm font-semibold text-text-primary">
            {proposed || "Not provided"}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
