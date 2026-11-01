import { useMemo, useState } from "react";
import { Sector } from "recharts";
import MetricDonut from "../../components/MetricDonut";
import { formatCount } from "../../analytics/utils/presentation";
import useChartEntrance from "../hooks/useChartEntrance";

/** Match the business KPI donut using current Explorer/Merchant account status, never recent engagement. */
export default function AccountStatusDonut({ activeCount, distribution }) {
  const [selected, setSelected] = useState(null);
  const explorer = distribution?.explorer;
  const merchant = distribution?.merchant;
  const total = explorer + merchant;
  const available =
    [activeCount, explorer, merchant].every(
      (count) => Number.isInteger(count) && count >= 0,
    ) && activeCount <= total;
  const source = useMemo(
    () => ({ activeCount, distribution }),
    [activeCount, distribution],
  );
  const animation = useChartEntrance(available && total > 0 ? source : null);
  const data = [
    { name: "Active", value: activeCount },
    { name: "Other statuses", value: total - activeCount },
  ];
  function select(index) {
    animation.stop();
    setSelected(index);
  }
  function sector(props) {
    const row = data[props.index];
    return (
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={props.innerRadius}
        outerRadius={props.outerRadius}
        startAngle={props.startAngle}
        endAngle={props.endAngle}
        fill={props.fill}
        stroke="none"
        role="button"
        tabIndex={0}
        aria-label={`${row.name}: ${formatCount(row.value)} accounts, ${((row.value / total) * 100).toFixed(1)}% of Explorer and Merchant accounts`}
        className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        onFocus={() => select(props.index)}
        onBlur={() => setSelected(null)}
        onClick={() => select(props.index)}
        onMouseLeave={() => setSelected(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            select(props.index);
          }
          if (event.key === "Escape") {
            setSelected(null);
            event.currentTarget.blur();
          }
        }}
      />
    );
  }
  return (
    <figure
      aria-label="Explorer and Merchant account statuses"
      className="w-20 shrink-0 self-center"
    >
      {/* The shared donut preserves the business card's size, ring, center and native tooltip. */}
      {available && total > 0 ? (
        <MetricDonut
          data={data}
          pieProps={{
            shape: sector,
            isAnimationActive: animation.isAnimationActive,
            animationDuration: animation.animationDuration,
            animationEasing: animation.animationEasing,
            onAnimationEnd: animation.onAnimationEnd,
            onMouseEnter: animation.stop,
          }}
          tooltipProps={{
            active: selected !== null ? true : undefined,
            defaultIndex: selected ?? undefined,
            formatter: (value, name) => [
              `${formatCount(value)} accounts · ${((value / total) * 100).toFixed(1)}%`,
              name,
            ],
          }}
        />
      ) : (
        <p className="flex h-20 items-center text-center text-xs text-text-secondary">
          {available
            ? "No Explorer or Merchant accounts"
            : "Status unavailable"}
        </p>
      )}
      <figcaption className="sr-only">
        {available
          ? `Explorer and Merchant accounts only: ${formatCount(activeCount)} active of ${formatCount(total)} accounts. Other statuses include pending, suspended, disabled, and unrecognized non-active statuses.`
          : "Account status distribution unavailable."}
      </figcaption>
    </figure>
  );
}
