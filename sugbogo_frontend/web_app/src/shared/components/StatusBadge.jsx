/**
 * Provides a reusable status badge with consistent sizing,
 * typography, and semantic color variants across the app.
 */
export default function StatusBadge({ children, variant = "neutral" }) {
  const variantClasses = {
    neutral: "bg-slate-500 text-white",
    muted: "bg-slate-200 text-slate-700",
    success: "bg-emerald-500 text-white",
    successSoft: "border border-success/25 bg-success/10 text-success",
    warning: "bg-amber-500 text-white",
    warningSoft: "border border-warning/30 bg-warning/10 text-warning",
    danger: "bg-red-500 text-white",
    dangerSoft: "border border-danger/25 bg-danger/10 text-red-700",
    info: "bg-blue-500 text-white",
    infoSoft: "border border-info/25 bg-info/10 text-info",
    mutedSoft: "border border-stroke bg-surface-muted text-text-secondary",
  };

  const dotClasses = {
    neutral: "bg-slate-200",
    muted: "bg-slate-400",
    success: "bg-emerald-100",
    successSoft: "bg-success",
    warning: "bg-amber-100",
    warningSoft: "bg-warning",
    danger: "bg-red-100",
    dangerSoft: "bg-danger",
    info: "bg-blue-100",
    infoSoft: "bg-info",
    mutedSoft: "bg-slate-500",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        variantClasses[variant] ?? variantClasses.neutral
      }`}
    >
      {/* Status indicator */}
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          dotClasses[variant] ?? dotClasses.neutral
        }`}
      />

      {/* Status label */}
      {children}
    </span>
  );
}
