import AnalyticsMetricSelector from "./AnalyticsMetricSelector";

const INTERVALS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

/** Selects supported reporting intervals independently of the period and data hook. */
export default function AnalyticsIntervalControl({ value = "daily", onChange, disabled = false }) {
  return (
    <>
      {/* Shared Admin selection pattern */}
      <AnalyticsMetricSelector label="Interval" value={value} onChange={onChange} options={INTERVALS} disabled={disabled} />
    </>
  );
}
