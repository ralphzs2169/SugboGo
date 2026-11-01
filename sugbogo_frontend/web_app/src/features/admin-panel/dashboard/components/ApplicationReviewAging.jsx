import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { formatCount } from "../../analytics/utils/presentation";

/** Plot only backend weekday categories, with exact text values and unclassified ages kept separate. */
export default function ApplicationReviewAging({ aging }) {
  const rows = [
    { key: "on_time", label: "On time", days: "0–2 weekdays", color: "var(--color-neutral)" },
    { key: "approaching", label: "Approaching", days: "3–4 weekdays", color: "var(--color-warning)" },
    { key: "overdue", label: "Overdue", days: "5+ weekdays", color: "var(--color-danger)" },
  ].map((row) => ({ ...row, count: aging?.[row.key] }));
  const available = rows.every((row) => row.count != null);

  return (
    <div>
      {/* Recharts uses Analytics tokens; adjacent exact values provide the accessible alternative */}
      {available && rows.some((row) => row.count > 0) && (
        <div aria-hidden="true" className="h-36 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 0 }} accessibilityLayer={false}>
              <XAxis type="number" hide allowDecimals={false} domain={[0, "auto"]} />
              <YAxis type="category" dataKey="days" width={90} axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
              <Bar dataKey="count" maxBarSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {rows.map((row) => <Cell key={row.key} fill={row.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {available && rows.every((row) => row.count === 0) && <p className="mb-4 text-sm text-text-secondary">No submissions with known aging.</p>}
      <dl className="space-y-3 text-xs">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary">{row.days}<span className="ml-2 text-text-primary">{row.label}</span></dt>
            <dd className="font-semibold tabular-nums text-text-primary">{formatCount(row.count)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-text-secondary">Submission day and weekends excluded.</p>
      {aging?.unknown_age > 0 && <p className="mt-2 text-xs text-text-secondary">{formatCount(aging.unknown_age)} submissions have unavailable aging data.</p>}
    </div>
  );
}
