import { ClipboardList, Clock, Hourglass, TriangleAlert } from "lucide-react";

import MetricCard from "@/features/admin-panel/components/MetricCard";

/** Displays current review workload and urgency using backend queue metrics. */
export default function BusinessApplicationMetrics({
  pendingReview,
  approachingSla,
  overdue,
  oldestPendingBusinessDays,
  onFilterQueue,
}) {
  const metrics = [
    {
      title: "Pending Review",
      icon: ClipboardList,
      value: pendingReview ?? "—",
      subtitle: "Applications awaiting a decision",
      queueStatus: "",
    },
    {
      title: "Approaching SLA",
      icon: Clock,
      value: <span className="text-warning">{approachingSla ?? "—"}</span>,
      subtitle: "3–4 business days",
      queueStatus: "approaching",
    },
    {
      title: "Overdue",
      icon: TriangleAlert,
      value: <span className="text-danger">{overdue ?? "—"}</span>,
      subtitle: "5+ business days",
      queueStatus: "overdue",
    },
    {
      title: "Oldest Pending",
      icon: Hourglass,
      value: oldestPendingBusinessDays == null ? "—" : (
        <>
          {oldestPendingBusinessDays}
          <span className="text-sm font-medium tracking-normal"> business days</span>
        </>
      ),
      subtitle: "Longest unresolved application",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.title} className="relative">
          <MetricCard
            title={metric.title}
            icon={metric.icon}
            value={metric.value}
            footerValue={metric.subtitle}
          />
          {onFilterQueue && metric.queueStatus !== undefined && (
            <button
              type="button"
              aria-label={`Filter applications: ${metric.title}`}
              onClick={() => onFilterQueue(metric.queueStatus)}
              className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          )}
        </div>
      ))}
    </div>
  );
}
