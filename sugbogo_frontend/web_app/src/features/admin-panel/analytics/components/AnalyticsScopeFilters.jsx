import { useId } from "react";
import SelectInput from "@/shared/components/forms/SelectInput";
import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useAnalyticsTaxonomy from "../hooks/useAnalyticsTaxonomy";

/** Uses shared current taxonomy options while each report owns its independent selected scope. */
export default function AnalyticsScopeFilters({ scope, value, onChange, clusterLabel, categoryLabel }) {
  const id = useId();
  const { clusters, categories } = useAnalyticsTaxonomy();
  useApiErrorNotification(clusters.error, { toastId: "analytics-clusters-error", fallbackMessage: "Unable to load cluster options." });
  useApiErrorNotification(categories.error, { toastId: "analytics-categories-error", fallbackMessage: "Unable to load category options." });
  const categoryOptions = (categories.data ?? []).filter((row) => !value.cluster || String(row.cluster_id) === String(value.cluster));
  return (
    <div className="flex max-w-full flex-wrap items-end gap-2">
      {/* Native labelled filters keep category selections compatible with the cluster */}
      <div className="w-32 min-w-0 flex-1"><SelectInput compact id={`${id}-cluster`} label={clusterLabel ?? `${scope} cluster`} value={value.cluster ?? ""} onChange={(event) => onChange({ cluster: event.target.value, category: "" })} placeholder={clusters.isLoading ? "Loading clusters..." : "All clusters"} disabled={!clusters.data}>
        {(clusters.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </SelectInput></div>
      <div className="w-32 min-w-0 flex-1"><SelectInput compact id={`${id}-category`} label={categoryLabel ?? `${scope} category`} value={value.category ?? ""} onChange={(event) => onChange({ ...value, category: event.target.value })} placeholder={categories.isLoading ? "Loading categories..." : "All categories"} disabled={!categories.data}>
        {categoryOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </SelectInput></div>
      {/* Option-source failures do not discard a healthy report */}
      {clusters.error && <div role="alert" className="text-sm text-text-secondary">Cluster options unavailable. <Button variant="secondary" onClick={() => clusters.refetch()}>Retry clusters</Button></div>}
      {categories.error && <div role="alert" className="text-sm text-text-secondary">Category options unavailable. <Button variant="secondary" onClick={() => categories.refetch()}>Retry categories</Button></div>}
    </div>
  );
}
