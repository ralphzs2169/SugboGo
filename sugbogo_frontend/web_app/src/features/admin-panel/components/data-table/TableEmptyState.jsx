/**
 * Displays a centered empty state when the table contains no records.
 */
function TableEmptyState({ title, description, icon }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
      {icon}

      <h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>

      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

export default TableEmptyState;
