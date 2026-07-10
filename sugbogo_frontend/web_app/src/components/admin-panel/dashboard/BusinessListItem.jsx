import React from "react";
import StatusBadge from "./StatusBadge";

/**
 * A single business list item component for the admin dashboard,
 * displaying business details and optional status or metrics.
 *
 * @component
 * @param {string} name - The business name to display.
 * @param {string} subtitle - A secondary description or subtitle for the business.
 * @param {string} image - URL of the business image or logo.
 * @param {string} badgeText - Optional text for a status badge (e.g., "Active", "Pending").
 * @param {string} badgeVariant - Tailwind CSS variant for the badge (e.g., "success", "warning").
 * @param {string|number} rightStat - Optional numeric or string statistic to display on the right side.
 * @param {string} rightStatLabel - Label for the right-side statistic (e.g., "Orders", "Revenue").
 */
const BusinessListItem = ({
  name,
  subtitle,
  image,
  badgeText,
  badgeVariant,
  rightStat,
  rightStatLabel,
}) => {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0 border-b border-stroke  last:border-0">
      <div className="flex items-center gap-3">
        <img
          src={image}
          alt={name}
          className="h-11 w-11 rounded-xl object-cover bg-slate-100"
        />
        <div>
          <h4 className="text-sm font-bold text-text-primary leading-tight">
            {name}
          </h4>
          <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Dynamic Right Side: either a mini badge or stacked trending metrics */}
      {badgeText && <StatusBadge variant={badgeVariant} text={badgeText} />}

      {rightStat && (
        <div className="text-right">
          <span className="block text-sm font-black text-[#f27e13] leading-none">
            {rightStat}
          </span>
          <span className="text-[9px] font-bold tracking-wider text-text-secondary uppercase block mt-0.5">
            {rightStatLabel}
          </span>
        </div>
      )}
    </div>
  );
};

export default BusinessListItem;
