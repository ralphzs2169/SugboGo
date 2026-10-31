import FilterMenu from "../../components/data-table/FilterMenu";
import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useAnalyticsTaxonomy from "../hooks/useAnalyticsTaxonomy";

/** Uses shared current taxonomy options while each report owns its independent selected scope. */
export default function AnalyticsScopeFilters({
  scope,
  value,
  onChange,
}) {
  const { clusters, categories } = useAnalyticsTaxonomy();
  useApiErrorNotification(clusters.error, { toastId: "analytics-clusters-error", fallbackMessage: "Unable to load cluster options." });
  useApiErrorNotification(categories.error, { toastId: "analytics-categories-error", fallbackMessage: "Unable to load category options." });
  const categoryOptions = (categories.data ?? []).filter((row) => !value.cluster || String(row.cluster_id) === String(value.cluster));
  return (
    <div className="flex max-w-full flex-wrap items-end gap-2">
      <FilterMenu ariaLabel={`${scope} filters`} align="right" disabled={!clusters.data || !categories.data} filters={[
        { key: "cluster", label: "Cluster", value: String(value.cluster ?? ""),
          options: [{ value: "", label: "All clusters" }, ...(clusters.data ?? []).map((row) => ({ value: String(row.id), label: row.name }))],
          onChange: (cluster) => onChange({ cluster, category: "" }) },
        { key: "category", label: "Category", value: String(value.category ?? ""),
          options: [{ value: "", label: "All categories" }, ...categoryOptions.map((row) => ({ value: String(row.id), label: row.name }))],
          onChange: (category) => onChange({ ...value, category }) },
      ]} />
      {/* Option-source failures do not discard a healthy report */}
      {clusters.error && <div role="alert" className="text-sm text-text-secondary">Cluster options unavailable. <Button variant="secondary" onClick={() => clusters.refetch()}>Retry clusters</Button></div>}
      {categories.error && <div role="alert" className="text-sm text-text-secondary">Category options unavailable. <Button variant="secondary" onClick={() => categories.refetch()}>Retry categories</Button></div>}
    </div>
  );
}
