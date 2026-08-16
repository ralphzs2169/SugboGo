import clsx from "clsx";
import { CLUSTER_ICONS } from "../constants/clusterIcons";

/**
 * Displays a cluster using either a standard label presentation
 * or a compact badge suitable for overlays and previews.
 */
export default function ClusterDisplay({
  clusterName,
  clusterIcon,
  variant = "default",
  className,
}) {
  const cluster = CLUSTER_ICONS.find((item) => item.value === clusterIcon);

  const Icon = cluster?.icon;

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

  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <div className="flex shrink-0 items-center justify-center text-text-secondary">
        {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
      </div>

      <span className="text-sm text-text-primary">{clusterName || "—"}</span>
    </div>
  );
}
