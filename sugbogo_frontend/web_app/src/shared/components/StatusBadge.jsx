/**
 * Provides a reusable status badge with consistent sizing,
 * typography, and semantic color variants across the app.
 */
export default function StatusBadge({ children, variant = "neutral" }) {
  const variantClasses = {
    neutral: "bg-slate-500 text-white",
    success: "bg-emerald-500 text-white",
    warning: "bg-amber-500 text-white",
    danger: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
  };

  const dotClasses = {
    neutral: "bg-slate-200",
    success: "bg-emerald-100",
    warning: "bg-amber-100",
    danger: "bg-red-100",
    info: "bg-blue-100",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        variantClasses[variant] ?? variantClasses.neutral
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          dotClasses[variant] ?? dotClasses.neutral
        }`}
      />

      {children}
    </span>
  );
}
