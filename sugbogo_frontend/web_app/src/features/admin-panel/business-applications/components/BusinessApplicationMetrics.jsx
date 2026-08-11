import MetricCard from "@/features/admin-panel/components/MetricCard";

export default function BusinessApplicationMetrics({
  pendingReview,
  approved,
  rejected,
  totalApplications,
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Pending Review"
        value={pendingReview}
        footerText="Awaiting review"
      />

      <MetricCard
        title="Approved"
        value={approved}
        footerText="Approved applications"
      />

      <MetricCard
        title="Rejected"
        value={rejected}
        footerText="Rejected applications"
      />

      <MetricCard
        title="Total Applications"
        value={totalApplications}
        footerText="All applications"
      />
    </div>
  );
}
