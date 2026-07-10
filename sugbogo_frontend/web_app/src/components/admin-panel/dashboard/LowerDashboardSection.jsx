import React from "react";
import RecentActivity from "./RecentActivity";
import QuickActions from "./QuickActions";
import BusinessInsightCard from "./BusinessInsightCard";
import { EyeOff, TrendingUp } from "lucide-react";

const underDiscoveredItems = [
  {
    name: "Liloan Lechon House",
    subtitle: "Low saves relative to traffic",
    badgeText: "Low Saves",
    badgeVariant: "critical",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&auto=format&fit=crop&q=60",
  },
  {
    name: "Mactan Watersports",
    subtitle: "Zero community vouches",
    badgeText: "No Vouches",
    badgeVariant: "warning",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&auto=format&fit=crop&q=60",
  },
  {
    name: "Cebu Heritage Tour",
    subtitle: "Engagement -18% month-over-month",
    badgeText: "Declining",
    badgeVariant: "muted",
    image:
      "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=100&auto=format&fit=crop&q=60",
  },
];

const topTrendingItems = [
  {
    name: "Sutukil Express",
    subtitle: "Viral in Mactan area",
    rightStat: "+23%",
    rightStatLabel: "Discovery",
    image:
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=100&auto=format&fit=crop&q=60",
  },
  {
    name: "Bantayan Island Stay",
    subtitle: "Top choice for local explorers",
    rightStat: "Most Saved",
    rightStatLabel: "Global Rank #1",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&auto=format&fit=crop&q=60",
  },
  {
    name: "Sirao Garden Tour",
    subtitle: "Increased weekend bookings",
    rightStat: "+12%",
    rightStatLabel: "Interest",
    image:
      "https://images.unsplash.com/photo-1465146633011-14f8e0781093?w=100&auto=format&fit=crop&q=60",
  },
];

function LowerDashboardSection() {
  return (
    <div className="w-full bg-background-secondary">
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2">
          <BusinessInsightCard
            title="Under-Discovered MSMEs"
            Icon={EyeOff}
            items={underDiscoveredItems}
          />

          <BusinessInsightCard
            title="Top Trending"
            Icon={TrendingUp}
            items={topTrendingItems}
          />
        </div>

        {/* Right Lower Section Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2 items-stretch">
          <RecentActivity />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

export default LowerDashboardSection;
