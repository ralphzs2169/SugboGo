import { formatCount } from "../utils/presentation";

/** Ranks small aggregate populations with exact labels; bar lengths are relative visual scale only. */
export default function AnalyticsRanking({ label, rows = [], emptyMessage = "No records for this selection." }) {
  const known = rows.filter((row) => row.value !== null && row.value !== undefined);
  const maximum = known.length ? Math.max(...known.map((row) => row.value)) : 0;
  return (
    <ol aria-label={label} className="space-y-3">
      {/* Values remain text, including measured zero and unavailable evidence */}
      {rows.map((row) => (
        <li key={row.id} className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs"><span className="min-w-0 truncate text-text-primary" title={row.name}>{row.name}</span><span className="shrink-0 font-semibold tabular-nums text-text-primary">{formatCount(row.value)}</span></div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-info/75" style={{ width: row.value == null || maximum === 0 ? "0%" : `${row.value / maximum * 100}%` }} /></div>
        </li>
      ))}
      {!rows.length && <li className="py-4 text-sm text-text-secondary">{emptyMessage}</li>}
    </ol>
  );
}
