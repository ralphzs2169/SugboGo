export default function CategoryFilters({
  clusters,
  selectedCluster,
  onChange,
}) {
  return (
    <select
      value={selectedCluster}
      onChange={(e) => onChange(e.target.value)}
      className=" rounded-md border border-stroke bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 "
    >
      <option value="">All Clusters</option>

      {clusters.map((cluster) => (
        <option key={cluster.id} value={cluster.id}>
          {cluster.name}
        </option>
      ))}
    </select>
  );
}
