import { ArrowRight, Info } from "lucide-react";
import { formatTimestamp } from "../utils/presentation";
import Tooltip from "@/shared/components/actions/Tooltip";
import { reliabilitySummary } from "../utils/reliabilityPresentation";

/** Keeps report updates, visible coverage status and drawer actions consistent. */
export default function AnalyticsReportFooter({
  title,
  meta,
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
        <Tooltip asChild place="top" openOnClick content={coverageDescription || reliabilitySummary(meta, title)}
          closeEvents={{ blur: true }} globalCloseEvents={{ escape: true, clickOutsideAnchor: true, scroll: true, resize: true }}
          className="!z-50 max-w-[min(22rem,calc(100vw-2rem))] whitespace-normal !px-3 !py-2 leading-relaxed">
          <button type="button" aria-label={`${title} data reliability`} disabled={!hasDetails} className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50"><Info aria-hidden="true" className="h-4 w-4" /></button>
        </Tooltip>
      </div>
      <button type="button" disabled={!hasData} onClick={onData} className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 font-medium text-text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-50">View data <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
    </div>
  );
}
