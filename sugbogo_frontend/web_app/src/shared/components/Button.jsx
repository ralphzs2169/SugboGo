import clsx from "clsx";
import { LoaderCircle } from "lucide-react";

/**
 * Reusable button component.
 *
 * @param {Object} props
 * @param {"button"|"submit"|"reset"} [props.type]
 * @param {"primary"|"secondary"|"danger"|"ghost"} [props.variant]
 * @param {"sm"|"md"} [props.size]
 * @param {React.ElementType} [props.icon]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} props.children
 * @param {Function} [props.onClick]
 * @param {string} [props.className]
 * @param {boolean} [props.iconOnly]
 *
 * @returns {JSX.Element}
 */
export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  iconOnly = false,
  ...props
}) {
  const baseClasses =
    "cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

  const sizeClasses = {
    sm: iconOnly ? "h-8 w-8 p-0" : "px-3 py-2 text-sm",
    md: iconOnly ? "h-10 w-10 p-0" : "px-4 py-2 text-sm",
  };

  const variantClasses = {
    primary: "bg-primary text-white hover:opacity-90 active:opacity-80",

    secondary:
      "border border-stroke bg-background text-text-primary hover:bg-surface",

    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",

    edit: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",

    delete: "text-red-600 hover:bg-red-50 hover:text-red-700",

    ghost:
      "bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className="h-4 w-4" />
      )}

      {!iconOnly && <span>{children}</span>}
    </button>
  );
}
