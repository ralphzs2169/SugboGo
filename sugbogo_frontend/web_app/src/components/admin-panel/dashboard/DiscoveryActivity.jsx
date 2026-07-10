import React from "react";
import { Compass, TrendingUp, Activity } from "lucide-react";
import DiscoveryChart from "./DiscoveryChart";

/**
 * DiscoveryActivity component that displays a summary of discovery metrics for the current week.
 * It includes a header with an icon, a bar chart visualization, and a footer with trend information and a graph.
 */
function DiscoveryActivity() {
  return (
    <div className="w-full rounded-lg border border-stroke bg-background-primary p-6 shadow-sm">
      {/* Top Header Section */}
      <div className="flex items-start justify-between">
        {/* Left Side: Icon + Text Wrapper */}
        <div className="flex items-start gap-3">
          {/* New Icon Before Title */}
          <Activity className="h-6 w-6 text-text-primary mt-1 stroke-[2.5]" />

          <div>
            <h2 className="text-2xl font-bold text-text-primary">
              Discovery Activity
            </h2>
            <p className="mt-1 text-[10px] font-bold tracking-widest text-text-secondary uppercase">
              This Week
            </p>
          </div>
        </div>

        {/* Compass Action Icon */}
        {/* <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50/60 text-[#f27e13] transition-colors hover:bg-orange-100/70">
          <Compass className="h-5 w-5 stroke-[2]" />
        </button> */}
      </div>

      {/* Reusable Bar Chart Component */}
      <DiscoveryChart />

      {/* Footer Section */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Trend Info & Sparkline */}
        <div className="flex items-center gap-3">
          {/* Green Pill Badge */}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5 stroke-[2.5]" />
            +12.5% vs last week
          </span>

          {/* Custom SVG Sparkline Graph */}
          <svg
            className="h-6 w-16 text-emerald-500"
            viewBox="0 0 60 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 16 Q 12 16, 20 13 T 36 4 T 48 10 T 58 2" />
          </svg>
        </div>

        {/* Sub-text Disclaimer */}
        <p className="text-[10px] font-medium text-text-secondary">
          Discovery metrics across all platform touchpoints
        </p>
      </div>
    </div>
  );
}

export default DiscoveryActivity;
