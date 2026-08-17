import clsx from "clsx";
import { LoaderCircle } from "lucide-react";

import Tooltip from "@/shared/components/actions/Tooltip";

/**
 * Reusable button component.
 *
 * Supports variants, sizes, icons, loading states, disabled states,
 * optional disabled tooltips, and optional hover tooltips.
 */
export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  disabledTooltip,
  tooltipMessage,
  className = "",
  iconOnly = false,
  ...props
}) {
  const baseClasses =
    "cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-stroke-active/20 disabled:cursor-not-allowed disabled:opacity-50";

  const sizeClasses = {
    sm: iconOnly ? "h-8 w-8 p-0" : "px-3 py-2 text-sm",
    md: iconOnly ? "h-10 w-10 p-0" : "px-4 py-2 text-sm",
  };

  const variantClasses = {
    primary: "bg-primary text-white hover:opacity-90 active:opacity-80",

    secondary:
      "border border-stroke bg-background text-text-primary hover:bg-surface",

    // used for actions column in tables
    action:
      "bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary",

    success: "bg-success text-white hover:opacity-90 active:opacity-80",

    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",

    edit: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",

    delete: "text-red-600 hover:bg-red-50 hover:text-red-700",

    ghost:
      "bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary",
  };

  const button = (
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
        <LoaderCircle size={18} className="animate-spin" />
      ) : (
        Icon && <Icon size={18} />
      )}

      {!iconOnly && <span>{children}</span>}
    </button>
  );

  if (disabled && disabledTooltip) {
    return <Tooltip content={disabledTooltip}>{button}</Tooltip>;
  }

  if (tooltipMessage) {
    return (
      <Tooltip content={tooltipMessage} asChild>
        {button}
      </Tooltip>
    );
  }

  return button;
}
