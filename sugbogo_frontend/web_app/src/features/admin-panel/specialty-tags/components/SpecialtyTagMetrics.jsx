import MetricCard from "@/features/admin-panel/components/MetricCard";

export default function SpecialtyTagMetrics({ totalTags }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Total Specialty Tags"
        value={totalTags}
        footerText="Across all specialty tags"
      />

      <MetricCard title="Most Used Tag" value="—" footerText="Business usage" />

      <MetricCard
        title="Most Vouched Tag"
        value="—"
        footerText="Explorer vouches"
      />

      <MetricCard
        title="Least Used Tag"
        value="—"
        footerText="Business usage"
      />
    </div>
  );
}
