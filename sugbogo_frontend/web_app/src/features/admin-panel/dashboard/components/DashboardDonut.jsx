import { useState } from "react";
import { Sector } from "recharts";
import MetricDonut from "../../components/MetricDonut";
import { formatCount } from "../../analytics/utils/presentation";
import useChartEntrance from "../hooks/useChartEntrance";

/** Reuse the shared metric donut and native tooltip while keeping role values keyboard-accessible. */
export default function DashboardDonut({
  rows,
  total,
  source,
  label,
  unit,
  denominator,
  emptyMessage,
  centerLabel,
}) {
  const [highlighted, setHighlighted] = useState(null);
  const available =
    Number.isInteger(total) &&
    total >= 0 &&
    rows.every((row) => Number.isInteger(row.count) && row.count >= 0) &&
    rows.reduce((sum, row) => sum + row.count, 0) === total;
  const animation = useChartEntrance(available && total > 0 ? source : null, {
    animationDuration: 1500,
    animationEasing: "ease",
  });
  const visibleRows = rows.filter((row) => !row.optional || row.count > 0);
  const percent = (value) =>
    `${(total > 0 ? (value / total) * 100 : 0).toFixed(1)}%`;
  const description = (row) =>
    `${row.label}: ${formatCount(row.count)} ${unit}, ${available ? `${percent(row.count)} of ${denominator}` : "distribution unavailable"}`;
  function highlight(key) {
    animation.stop();
    setHighlighted(key);
  }
  function clear(event) {
    if (event.key === "Escape") {
      setHighlighted(null);
      event.currentTarget.blur();
    }
  }
  function sector(props) {
    const row = rows[props.index];
    return (
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={props.innerRadius}
        outerRadius={props.outerRadius}
        startAngle={props.startAngle}
        endAngle={props.endAngle}
        fill={row.color}
        stroke="none"
        tabIndex={0}
        role="img"
        aria-label={description(row)}
        className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        onMouseEnter={() => highlight(row.key)}
        onMouseLeave={() => setHighlighted(null)}
        onFocus={() => highlight(row.key)}
        onBlur={() => setHighlighted(null)}
        onClick={() => highlight(row.key)}
        onKeyDown={clear}
      />
    );
  }
  const center = (
    <>
      <span className="text-xs text-text-secondary">{centerLabel}</span>
      <span className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
        {formatCount(total)}
      </span>
    </>
  );
  return (
    <figure aria-label={label} className="min-w-0">
      {/* The established metric donut supplies segment styling and native Recharts hover behavior. */}
      {available && total > 0 ? (
        <MetricDonut
          data={rows.map((row) => ({
            ...row,
            name: row.label,
            value: row.count,
          }))}
          className="relative mx-auto h-44 w-full min-w-0"
          innerRadius={60}
          outerRadius={82}
          centerContent={center}
          pieProps={{
            shape: sector,
            isAnimationActive: animation.isAnimationActive,
            animationDuration: animation.animationDuration,
            animationEasing: animation.animationEasing,
            onAnimationEnd: animation.onAnimationEnd,
          }}
          tooltipProps={{
            active: highlighted ? true : undefined,
            defaultIndex: highlighted
              ? rows.findIndex((row) => row.key === highlighted)
              : undefined,
            formatter: (value, name) => [
              `${formatCount(value)} ${unit} · ${percent(value)} of ${denominator}`,
              name,
            ],
          }}
        />
      ) : (
        <div className="flex h-44 flex-col items-center justify-center">
          {center}
        </div>
      )}
      {/* Legend focus selects the same native tooltip without custom outlines or fading sectors. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {visibleRows.map((row) => (
          <div key={row.key}>
            <dt className="sr-only">{row.label}</dt>
            <dd>
              <button
                type="button"
                aria-label={description(row)}
                onMouseEnter={() => highlight(row.key)}
                onMouseLeave={() => setHighlighted(null)}
                onFocus={() => highlight(row.key)}
                onBlur={() => setHighlighted(null)}
                onClick={() => highlight(row.key)}
                onKeyDown={clear}
                className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded px-1 text-left text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="break-words">{row.label}</span>
                </span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatCount(row.count)}
                </span>
              </button>
            </dd>
          </div>
        ))}
      </dl>
      {(!available || total === 0) && (
        <figcaption className="mt-4 text-xs text-text-secondary">
          {available ? emptyMessage : "Distribution unavailable."}
        </figcaption>
      )}
    </figure>
  );
}
