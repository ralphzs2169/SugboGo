import React from "react";
import MetricBadge from "./MetricBadge";

/**
 * Data summary card that displays a key metric value with an icon and an optional status badge.
 *
 * @component
 * @param {string} title - Label text describing the metric category.
 * @param {string|number} value - Primary metric value rendered prominently in the card.
 * @param {string} [badgeVariant] - Optional badge color theme passed through to MetricBadge ('success' | 'warning' | 'danger').
 * @param {string} [badgeText] - Optional label text rendered inside the status badge.
 * @param {React.ComponentType} [Icon] - Optional lucide-react icon component rendered in a circular icon container.
 * @param {string} [iconBg] - Optional Tailwind background class string for the icon container.
 * @param {string} [iconColor] - Optional Tailwind text/icon color class string for the icon.
 * @param {string} [valueColor] - Optional Tailwind text color class string applied to the metric value.
 */
function MetricCard({
  title,
  value,
  badgeVariant,
  badgeText,
  Icon,
  iconBg,
  iconColor,
  valueColor,
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-stroke bg-background-primary p-6 shadow-sm hover:shadow-md flex flex-col justify-between min-h-[165px]">
      {/* Top Section: Circular Icon Graphic & Optional Right Badge */}
      <div className="flex items-center justify-between w-full">
        {Icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg || "bg-slate-50"} ${iconColor || "text-slate-500"}`}
          >
            <Icon className="h-5 w-5 stroke-[2]" />
          </div>
        )}
        <MetricBadge variant={badgeVariant} text={badgeText} />
      </div>

      {/* Bottom Section: Title Category & Scaled Data Value */}
      <div className="mt-3">
        <h3 className="text-[11px] font-bold tracking-widest text-text-secondary uppercase leading-relaxed">
          {title}
        </h3>
        <div
          className={`text-3xl font-bold tracking-tight mt-1 ${valueColor || "text-text-primary"}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export default MetricCard;
