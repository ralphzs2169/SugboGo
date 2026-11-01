import MetricDonut from "../../components/MetricDonut";
import useChartEntrance from "../hooks/useChartEntrance";
import { formatCount } from "../../analytics/utils/presentation";

/** Keep current business proportions subordinate to the active inventory KPI, disclosing unexpected statuses. */
export default function BusinessStatusDonut({ status }) {
  const keys = ["active", "suspended", "unknown_status"];
  const available =
    Number.isInteger(status?.total) &&
    status.total >= 0 &&
    keys.every((key) => Number.isInteger(status[key]) && status[key] >= 0) &&
    keys.reduce((sum, key) => sum + status[key], 0) === status.total;
  const animation = useChartEntrance(
    available && status.total > 0 ? status : null,
  );
  const data = [
    { name: "Active", value: status?.active },
    { name: "Suspended", value: status?.suspended },
    ...(status?.unknown_status > 0
      ? [{ name: "Other status", value: status.unknown_status }]
      : []),
  ];
  return (
    <figure
      aria-label="Current business statuses"
      className="w-20 shrink-0 self-center"
    >
      {/* Reuse the Business inventory card's donut, center percentage, colors and native tooltip. */}
      {available && status.total > 0 ? (
        <MetricDonut
          data={data}
          pieProps={{
            isAnimationActive: animation.isAnimationActive,
            animationDuration: animation.animationDuration,
            animationEasing: animation.animationEasing,
            onAnimationEnd: animation.onAnimationEnd,
            onMouseEnter: animation.stop,
          }}
          tooltipProps={{
            formatter: (value, name) => [
              `${formatCount(value)} businesses · ${((value / status.total) * 100).toFixed(1)}%`,
              name,
            ],
          }}
        />
      ) : (
        <p className="flex h-20 items-center text-center text-xs text-text-secondary">
          {available ? "No businesses" : "Status unavailable"}
        </p>
      )}
      <figcaption className="sr-only">
        {available
          ? data
              .map((row) => `${row.name}: ${formatCount(row.value)} businesses`)
              .join(". ")
          : "Distribution unavailable."}
      </figcaption>
    </figure>
  );
}
