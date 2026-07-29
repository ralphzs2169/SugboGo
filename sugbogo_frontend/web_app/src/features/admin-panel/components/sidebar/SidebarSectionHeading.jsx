/**
 * Displays a section label within the admin sidebar.
 *
 * Section headings are only shown when the sidebar is expanded
 * to visually group related navigation items.
 *
 * @component
 *
 * @param {Object} props
 * @param {string} props.title - Section title.
 *
 * @returns {JSX.Element}
 */
export default function SidebarSectionHeading({ title }) {
  return (
    <div className="mt-2 mb-2 first:mt-4">
      <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
        {title}
      </p>
    </div>
  );
}
