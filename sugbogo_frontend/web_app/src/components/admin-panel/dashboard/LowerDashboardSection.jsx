import React from 'react';
import { UnderDiscoveredMSMEs, TopTrending } from './BusinessPanels';
import RecentActivity from './RecentActivity';
import QuickActions from './QuickActions';

function LowerDashboardSection() {
  return (
    <div className="w-full bg-slate-50/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2">
          <UnderDiscoveredMSMEs />
          <TopTrending />
        </div>

        {/* Right Lower Section Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2 items-stretch">
          <RecentActivity />
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default LowerDashboardSection;