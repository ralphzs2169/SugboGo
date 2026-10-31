import SortMenu from "../../components/data-table/SortMenu";
import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useAnalyticsTaxonomy from "../hooks/useAnalyticsTaxonomy";

/** Uses shared current taxonomy options while each report owns its independent selected scope. */
export default function AnalyticsScopeFilters({ scope, value, onChange, clusterLabel, categoryLabel }) {
  const { clusters, categories } = useAnalyticsTaxonomy();
  useApiErrorNotification(clusters.error, { toastId: "analytics-clusters-error", fallbackMessage: "Unable to load cluster options." });
  useApiErrorNotification(categories.error, { toastId: "analytics-categories-error", fallbackMessage: "Unable to load category options." });
  const categoryOptions = (categories.data ?? []).filter((row) => !value.cluster || String(row.cluster_id) === String(value.cluster));
  return (
    <div className="flex max-w-full flex-wrap items-end gap-2">
      {/* Shared popovers retain the all-values choice and cluster/category compatibility. */}
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">{clusterLabel ?? `${scope} cluster`}</span>
        <SortMenu ariaLabel={clusterLabel ?? `${scope} cluster`} value={String(value.cluster ?? "")}
          onChange={(cluster) => onChange({ cluster, category: "" })}
          options={[{ value: "", label: "All clusters" }, ...(clusters.data ?? []).map((row) => ({ value: String(row.id), label: row.name }))]}
          triggerLabel={clusters.isLoading ? "Loading clusters..." : undefined} disabled={!clusters.data} />
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">{categoryLabel ?? `${scope} category`}</span>
        <SortMenu ariaLabel={categoryLabel ?? `${scope} category`} value={String(value.category ?? "")}
          onChange={(category) => onChange({ ...value, category })}
          options={[{ value: "", label: "All categories" }, ...categoryOptions.map((row) => ({ value: String(row.id), label: row.name }))]}
          triggerLabel={categories.isLoading ? "Loading categories..." : undefined} disabled={!categories.data} />
      </div>
      {/* Option-source failures do not discard a healthy report */}
      {clusters.error && <div role="alert" className="text-sm text-text-secondary">Cluster options unavailable. <Button variant="secondary" onClick={() => clusters.refetch()}>Retry clusters</Button></div>}
      {categories.error && <div role="alert" className="text-sm text-text-secondary">Category options unavailable. <Button variant="secondary" onClick={() => categories.refetch()}>Retry categories</Button></div>}
    </div>
  );
}
