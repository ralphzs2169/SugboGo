const SOFT_VARIANTS = {
  neutral: "mutedSoft",
  muted: "mutedSoft",
  success: "successSoft",
  warning: "warningSoft",
  danger: "dangerSoft",
  info: "infoSoft",
};

/**
 * Provides a reusable status badge with consistent sizing,
 * typography, and soft semantic color variants across Admin.
 */
export default function StatusBadge({ children, variant = "neutral" }) {
  const resolvedVariant = SOFT_VARIANTS[variant] ?? variant;
  const variantClasses = {
    successSoft: "border border-success/25 bg-success/10 text-success",
    warningSoft: "border border-warning/30 bg-warning/10 text-warning",
    dangerSoft: "border border-danger/25 bg-danger/10 text-danger",
    infoSoft: "border border-info/25 bg-info/10 text-info",
    mutedSoft: "border border-stroke bg-surface-muted text-text-secondary",
  };

  const dotClasses = {
    successSoft: "bg-success",
    warningSoft: "bg-warning",
    dangerSoft: "bg-danger",
    infoSoft: "bg-info",
    mutedSoft: "bg-slate-500",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        variantClasses[resolvedVariant] ?? variantClasses.mutedSoft
      }`}
    >
      {/* Status indicator */}
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          dotClasses[resolvedVariant] ?? dotClasses.mutedSoft
        }`}
      />

      {/* Status label */}
      {children}
    </span>
  );
}
