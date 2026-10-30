import { ArrowRight, Info } from "lucide-react";
import { formatTimestamp } from "../utils/presentation";

/** Keeps report updates, visible coverage status and drawer actions consistent. */
export default function AnalyticsReportFooter({
  title,
  meta,
  onAbout,
  onData,
  hasData,
  hasDetails = hasData,
  coverageDescription,
  coverageLabel = "Partial coverage",
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stroke pt-3 text-xs text-text-secondary">
      {/* Updated time is report generation, never a capture watermark. */}
      <div className="flex min-w-0 items-center gap-1">
        <span>Updated {formatTimestamp(meta?.generated_at)} PHT{meta?.is_partial ? ` · ${coverageLabel}` : ""}</span>
        <button type="button" aria-label={`About ${title}`} disabled={!hasDetails} onClick={onAbout} className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50"><Info aria-hidden="true" className="h-4 w-4" /></button>
      </div>
      <button type="button" disabled={!hasData} onClick={onData} className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 font-medium text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50">View data <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
      {meta?.is_partial && coverageDescription && (
        <p className="basis-full text-xs leading-relaxed text-text-secondary">
          {coverageDescription}
        </p>
      )}
    </div>
  );
}
