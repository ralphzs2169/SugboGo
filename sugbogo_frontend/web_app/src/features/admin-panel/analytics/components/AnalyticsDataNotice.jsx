import { AlertCircle, Clock3, Info } from "lucide-react";

const LABELS = {
  info: "Info",
  partial: "Partial data",
  unavailable: "Unavailable",
  snapshot: "Current snapshot",
  fixed: "Fixed observation window",
};

/** Places a compact source or measurement limitation beside its affected report. */
export default function AnalyticsDataNotice({ kind = "info", title, children }) {
  const Icon = kind === "unavailable" ? AlertCircle : kind === "fixed" ? Clock3 : Info;

  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm leading-relaxed">
      {/* Context label and explanation */}
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
      <div className="min-w-0 break-words">
        <span className="font-medium text-text-primary">{title ?? LABELS[kind] ?? LABELS.info}</span>
        {children && <div className="text-text-secondary">{children}</div>}
      </div>
    </div>
  );
}
