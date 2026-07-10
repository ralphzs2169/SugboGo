import React from "react";
import BusinessListItem from "./BusinessListItem";

/**
 * BusinessInsightCard component that displays a card with a title, icon, optional header action, and a list of business insight items.
 * @component
 * @param {string} title - The title of the card.
 * @param {React.Component} Icon - The icon component to display next to the title.
 * @param {Array} items - The list of business insight items to display.
 */
function BusinessInsightCard({ title, Icon, items = [] }) {
  return (
    <div className="rounded-lg border border-stroke bg-background-primary p-6 shadow-sm">
      <div className="mb-5 flex w-full items-center justify-between border-b border-stroke pb-3">
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 stroke-[2.5] text-text-primary" />
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item, index) => (
          <BusinessListItem key={index} {...item} />
        ))}
      </div>
    </div>
  );
}

export default BusinessInsightCard;
