/**
 * Reusable empty state view displayed when the table contains no rows after
 * applying data loading, search, filtering, or other table operations.
 *
 * @component
 * @param {string} title - Primary heading displayed to describe the empty state.
 * @param {string} description - Supporting message providing additional context or guidance.
 * @param {React.ReactNode} [icon] - Optional icon or illustration rendered above the text.
 */

function TableEmptyState({ title, description, icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {icon}

      <h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>

      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

export default TableEmptyState;
