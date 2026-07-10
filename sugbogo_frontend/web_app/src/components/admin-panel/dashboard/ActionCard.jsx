import React from "react";
import { ArrowRight } from "lucide-react";

/**
 * ActionCard component for the admin dashboard.
 * Displays a clickable card with an icon, title, description, and a right arrow indicator.
 *
 * @component
 * @param {string} title - The title text displayed on the card.
 * @param {string} description - The description text displayed below the title.
 * @param {React.Component} Icon - The icon component to display on the left side of the card.
 * @param {string} iconColor - Tailwind CSS class for the icon color.
 * @param {string} iconBg - Tailwind CSS class for the icon background color.
 */
function ActionCard({ title, description, Icon, iconColor, iconBg }) {
  return (
    <div className="group relative flex items-center justify-between rounded-lg border border-stroke bg-background-primary p-6 shadow-sm hover:shadow-md cursor-pointer">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}
        >
          <Icon className="h-5 w-5 stroke-[2]" />
        </div>
        <div>
          <h3 className="text-xs font-black tracking-wide text-text-primary uppercase">
            {title}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-6 w-6 text-text-secondary transition-transform group-hover:translate-x-1" />
    </div>
  );
}

export default ActionCard;
