import React from "react";
import { CheckCircle2, MessageSquarePlus, History } from "lucide-react"; // Imported History icon

const activities = [
  {
    id: 1,
    title: "New MSME approved",
    details: "Casa Verde Seaside has joined the platform.",
    time: "12 MINUTES AGO",
    type: "approval",
  },
  {
    id: 2,
    title: "New MSME approved",
    details: "Punoan ni Charmaine has joined the platform.",
    time: "45 MINUTES AGO",
    type: "approval",
  },
  {
    id: 3,
    title: "New review submitted",
    details: 'High fidelity review for "Taboan Market" received.',
    time: "2 HOURS AGO",
    type: "review",
  },
];

/**
 * RecentActivity component that displays a list of recent activities in a vertical timeline format.
 * Each activity is represented with an icon, title, details, and timestamp.
 */
function RecentActivity() {
  return (
    <div className="rounded-lg border border-stroke bg-background-primary p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header Container wrapping both Icon and Text */}
      <div className="w-full flex items-center justify-between mb-5 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 text-text-primary stroke-[2.5]" />
          <h2 className="text-lg font-bold text-text-primary">
            Recent Activity
          </h2>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col justify-between pl-2">
        {/* Continuous Connecting Line Background */}
        <div className="absolute left-[21px] top-4 bottom-4 w-px bg-background-secondary" />

        {activities.map((act, idx) => (
          <div
            key={act.id}
            className="relative flex items-start gap-4 pb-6 last:pb-0"
          >
            {/* Conditional Node Icons */}
            <div
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-4 border-white shadow-sm ${
                act.type === "approval"
                  ? "bg-emerald-50 text-emerald-500"
                  : "bg-blue-50 text-blue-500"
              }`}
            >
              {act.type === "approval" ? (
                <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
              ) : (
                <MessageSquarePlus className="h-3.5 w-3.5 stroke-[2.5]" />
              )}
            </div>

            <div className="flex flex-col">
              {/* Fixed typo from text-text-pimary to text-text-primary */}
              <h4 className="text-sm font-bold text-text-primary leading-none">
                {act.title}
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                {act.details}
              </p>
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase mt-2 block">
                {act.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentActivity;
