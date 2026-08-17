import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/**
 * Renders a compact KPI donut showing the proportion of the primary
 * metric against its comparison segment, with the primary percentage
 * displayed in the center.
 */
export default function MetricDonut({
  data = [],
  primaryName,
  primaryLabel = "Active",
}) {
  const points = data.filter(
    (item) => item.value !== null && item.value !== undefined,
  );

  const total = points.reduce((sum, item) => sum + Number(item.value), 0);

  if (!points.length || total <= 0) {
    return null;
  }

  const primaryItem = primaryName
    ? points.find((item) => item.name === primaryName)
    : points[0];

  const primaryValue = Number(primaryItem?.value ?? 0);
  const percentage = (primaryValue / total) * 100;

  const segmentColors = [
    "var(--color-success)",
    "var(--color-danger)",
    "var(--color-warning)",
    "var(--color-info)",
  ];

  return (
    <div className="relative h-20 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={points}
            dataKey="value"
            nameKey="name"
            innerRadius={27}
            outerRadius={36}
            paddingAngle={2}
            stroke="none"
          >
            {points.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={segmentColors[index % segmentColors.length]}
              />
            ))}
          </Pie>

          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--color-stroke)",
              backgroundColor: "var(--color-background)",
              fontSize: "11px",
              padding: "6px 8px",
            }}
            formatter={(value, name) => [value, name]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Donut center */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold leading-none text-text-primary">
          {percentage.toFixed(1)}%
        </span>

        <span className="mt-1 text-[8px] font-semibold uppercase tracking-wide text-text-secondary">
          {primaryLabel}
        </span>
      </div>
    </div>
  );
}
