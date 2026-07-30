/**
 * Renders the backdrop displayed behind the sidebar on mobile devices.
 *
 * The overlay is only rendered while the mobile sidebar is open and
 * closes the sidebar when clicked.
 *
 * @component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the mobile sidebar is open.
 * @param {Function} props.onClose - Closes the mobile sidebar.
 *
 * @returns {JSX.Element|null}
 */
export default function SidebarOverlay({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 lg:hidden"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
