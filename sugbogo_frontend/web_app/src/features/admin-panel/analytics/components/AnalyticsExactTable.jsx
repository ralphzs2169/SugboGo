/** Presents small aggregate reports and chart alternatives as labelled exact-value tables. */
export default function AnalyticsExactTable({ caption, rows = [], columns, emptyMessage = "No records for this selection." }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-stroke">
      {/* Exact values remain available without chart interaction */}
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-text-primary">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-stroke text-text-primary">
          {rows.map((row, index) => (
            <tr key={row.id ?? row.specialty_id ?? row.section ?? index}>
              {columns.map((column) => <td key={column.key} className="px-4 py-3">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-text-secondary">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
