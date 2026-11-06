import { Flag, Heart, MessageSquareText, ShieldQuestion } from "lucide-react";

import MetricCard from "@/features/admin-panel/components/MetricCard";
import UserDetailHeading from "./UserDetailHeading";

const METRIC_CONFIG = {
  reviews: {
    icon: MessageSquareText,
    label: "Reviews Submitted",
    description: "Retained reviews · all statuses",
  },
  vouches: {
    icon: Heart,
    label: "Non-withdrawn Vouches",
    description: "Includes flagged and invalidated vouches",
  },
  reports: {
    icon: Flag,
    label: "Reports Submitted",
    description: "All statuses · includes withdrawn reports",
  },
  review_disputes: {
    icon: ShieldQuestion,
    label: "Review Disputes",
    description: "Disputes submitted · all statuses",
  },
};

export default function UserActivitySummary({ summary = {}, role }) {
  const metrics = Object.entries(METRIC_CONFIG).filter(
    ([key]) => key !== "review_disputes" || role === "merchant",
  );

  return (
    <section aria-label="Activity summary" className="min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5">
      <UserDetailHeading icon={MessageSquareText} title="Activity Summary" description="Contributions submitted by this user" />

      <div className={`grid min-w-0 grid-cols-1 gap-4 ${
        metrics.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"
      }`}>
        {metrics.map(([key, metric]) => (
          <MetricCard
            key={key}
            wrapTitle
            title={metric.label}
            icon={metric.icon}
            value={summary[key] ?? "—"}
            footerValue={metric.description}
          />
        ))}
      </div>
    </section>
  );
}
