/**
 * Provides a reusable status and label badge with consistent
 * sizing, typography, and semantic color variants across the app.
 */
export default function StatusBadge({ children, variant = "neutral" }) {
  const variantClasses = {
    neutral: "bg-slate-500  text-white",
    success: "bg-green-500  text-white",
    warning: "bg-amber-500  text-white",
    danger: "bg-red-500  text-white",
    info: "bg-blue-500  text-white",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        variantClasses[variant] ?? variantClasses.neutral
      }`}
    >
      {children}
    </span>
  );
}
