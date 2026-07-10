import React from 'react';
import { EyeOff, TrendingUp } from 'lucide-react'; // Imported icons
import StatusBadge from './StatusBadge';
import BusinessListItem from './BusinessListItem';

export const UnderDiscoveredMSMEs = () => {
  const items = [
    { name: "Liloan Lechon House", subtitle: "Low saves relative to traffic", badgeText: "Low Saves", badgeVariant: "critical", image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&auto=format&fit=crop&q=60" },
    { name: "Mactan Watersports", subtitle: "Zero community vouches", badgeText: "No Vouches", badgeVariant: "warning", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&auto=format&fit=crop&q=60" },
    { name: "Cebu Heritage Tour", subtitle: "Engagement -18% month-over-month", badgeText: "Declining", badgeVariant: "muted", image: "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=100&auto=format&fit=crop&q=60" }
  ];

  return (
    <div className="rounded-lg border border-stroke bg-background-primary p-6 shadow-sm">
      {/* Header Container wrapping both Icon and Text */}
      <div className="w-full flex items-center justify-between mb-5 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5">
          <EyeOff className="h-5 w-5 text-text-primary stroke-[2.5]" />
          <h2 className="text-lg font-bold text-text-primary">Under-Discovered MSMEs</h2>
        </div>
      </div>
      
      <div className="flex flex-col gap-1">
        {items.map((item, idx) => <BusinessListItem key={idx} {...item} />)}
      </div>
    </div>
  );
};

export const TopTrending = () => {
  const items = [
    { name: "Sutukil Express", subtitle: "Viral in Mactan area", rightStat: "+23%", rightStatLabel: "Discovery", image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=100&auto=format&fit=crop&q=60" },
    { name: "Bantayan Island Stay", subtitle: "Top choice for local explorers", rightStat: "Most Saved", rightStatLabel: "Global Rank #1", image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&auto=format&fit=crop&q=60" },
    { name: "Sirao Garden Tour", subtitle: "Increased weekend bookings", rightStat: "+12%", rightStatLabel: "Interest", image: "https://images.unsplash.com/photo-1465146633011-14f8e0781093?w=100&auto=format&fit=crop&q=60" }
  ];

  return (
    <div className="rounded-lg border border-stroke bg-background-primary p-6 shadow-sm">
      {/* Header Container wrapping both Icon and Text */}
      <div className="w-full flex items-center justify-between mb-5 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="h-5 w-5 text-text-primary stroke-[2.5]" />
          <h2 className="text-lg font-bold text-text-primary">Top Trending</h2>
        </div>
        {/* <StatusBadge variant="growth" text="Growth" /> */}
      </div>
      
      <div className="flex flex-col gap-1">
        {items.map((item, idx) => <BusinessListItem key={idx} {...item} />)}
      </div>
    </div>
  );
};