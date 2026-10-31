import SortMenu from "../../components/data-table/SortMenu";

/** Uses the same labelled popover as Analytics interval controls. */
export default function AnalyticsMetricSelector({ label = "Metric", value, onChange, options, disabled = false }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <SortMenu ariaLabel={label} value={value} onChange={onChange} options={options} disabled={disabled} />
    </div>
  );
}
