import FilterMenu from "../../components/data-table/FilterMenu";
import TaxonomyOptionFeedback from "../../taxonomy/components/TaxonomyOptionFeedback";
import useAnalyticsTaxonomy from "../hooks/useAnalyticsTaxonomy";

/** Uses shared current taxonomy options while each report owns its independent selected scope. */
export default function AnalyticsScopeFilters({
  scope,
  value,
  onChange,
}) {
  const { clusters, categories } = useAnalyticsTaxonomy();
  const categoryOptions = (categories.data ?? []).filter((row) => !value.cluster || String(row.cluster_id) === String(value.cluster));
  return (
    <div className="flex max-w-full flex-wrap items-end gap-2">
      <FilterMenu ariaLabel={`${scope} filters`} align="right" filters={[
        { key: "cluster", label: "Cluster", disabled: clusters.data == null, value: String(value.cluster ?? ""),
          options: [{ value: "", label: "All clusters" }, ...(clusters.data ?? []).map((row) => ({ value: String(row.id), label: row.name }))],
          onChange: (cluster) => onChange({ cluster, category: "" }) },
        { key: "category", label: "Category", disabled: categories.data == null, value: String(value.category ?? ""),
          options: [{ value: "", label: "All categories" }, ...categoryOptions.map((row) => ({ value: String(row.id), label: row.name }))],
          onChange: (category) => onChange({ ...value, category }) },
      ]} />
      {/* Option-source failures do not discard a healthy report */}
      <TaxonomyOptionFeedback queries={[clusters, categories]} />
    </div>
  );
}
