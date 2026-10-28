/**
 * Displays a centered empty state when the table contains no records.
 */
function TableEmptyState({ title, description, icon, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "min-h-40 px-4 py-6" : "min-h-[520px]"}`}>
      {icon}

      <h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>

      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

export default TableEmptyState;
