import clsx from "clsx";
import { CLUSTER_ICONS } from "../constants/clusterIcons";

/**
 * Displays a cluster using either a standard label presentation,
 * a compact badge, a comparison value, or a smaller inline presentation.
 */
export default function ClusterDisplay({
  clusterName,
  clusterIcon,
  variant = "default",
  className,
  emphasized = false,
}) {
  const cluster = CLUSTER_ICONS.find((item) => item.value === clusterIcon);

  const Icon = cluster?.icon;

  if (variant === "comparison") {
    return (
      <div className={clsx("flex min-w-0 items-start gap-2.5", className)}>
        {Icon && (
          <Icon
            className="mt-1 h-5 w-5 shrink-0 text-text-secondary"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
        <span
          className={clsx(
            "min-w-0 break-words leading-7 text-text-primary",
            emphasized ? "text-xl font-bold" : "text-lg font-medium",
          )}
        >
          {clusterName || "Not provided"}
        </span>
      </div>
    );
  }

  if (variant === "badge") {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1",
          "text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur-sm",
          className,
        )}
      >
        {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}

        <span>{clusterName || "—"}</span>
      </span>
    );
  }

  if (variant === "small") {
    return (
      <div className={clsx("flex items-center gap-1.5", className)}>
        <div className="flex shrink-0 items-center justify-center text-text-secondary">
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
        </div>

        <span className="text-xs text-text-secondary">
          {clusterName || "—"}
        </span>
      </div>
    );
  }

  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <div className="flex shrink-0 items-center justify-center text-text-secondary">
        {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
      </div>

      <span className="text-sm text-text-primary">{clusterName || "—"}</span>
    </div>
  );
}
