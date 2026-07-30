/**
 * Displays the count badge attached to a table tab.
 *
 * @component
 * @param {number} count - Record count displayed inside the badge.
 * @param {boolean} isActive - Controls active/inactive styling.
 */
function TableTabBadge({ count, isActive }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        isActive ? "bg-primary text-white" : "bg-slate-100 text-gray-900"
      }`}
    >
      {count}
    </span>
  );
}

export default TableTabBadge;
