import MetricCard from "../../components/MetricCard";

const MEASUREMENT_LABELS = {
  current_snapshot: "Current snapshot",
  period: "Selected period",
  period_current_state: "Selected period · current state",
};
const INTENTS = { neutral: "neutral", positive: "success", negative: "danger" };
const UNITS = { percent: "%", percentage_points: " pts", count: "" };

/** Adapts backend KPI semantics to the existing Admin card without deriving new metrics.
 * Comparison color is explicit intent; direction alone never implies good or bad.
 */
export default function AnalyticsMetricCard({
  label,
  value,
  icon,
  formatValue = (number) => String(number),
  comparison,
  comparisonIntent = "neutral",
  comparisonLabel = "vs previous period",
  comparisonUnavailableMessage = "Comparison unavailable",
  measurementType,
  measurementLabel,
  context,
  unavailableMessage,
}) {
  const available = value !== null && value !== undefined;
  const comparable = available && comparison?.value != null;
  const trend = comparable ? {
    value: `${comparison.value}${UNITS[comparison.unit] ?? ""}`,
    direction: comparison.direction,
    variant: INTENTS[comparisonIntent] ?? "neutral",
  } : null;

  return (
    <MetricCard
      title={label}
      icon={icon}
      value={available ? formatValue(value) : null}
      wrapTitle
      trend={trend}
      footerLabel={comparisonLabel}
      measurementLabel={measurementLabel ?? MEASUREMENT_LABELS[measurementType]}
      context={(
        <>
          {/* Metric scope and unavailable comparison context */}
          {!available && <p>{unavailableMessage ?? "This metric is currently unavailable."}</p>}
          {available && comparison && !comparable && <p>{comparisonUnavailableMessage}</p>}
          {context && <div>{context}</div>}
        </>
      )}
    />
  );
}
