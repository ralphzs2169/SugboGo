import { X } from "lucide-react";
import { useEffect } from "react";

/**
 * Reusable modal dialog.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {string} props.title - Modal heading.
 * @param {string} [props.description] - Optional supporting text.
 * @param {Function} props.onClose - Called when the modal is dismissed.
 * @param {React.ReactNode} props.children - Modal content.
 * @param {boolean} [props.showCloseButton=true] - Whether to show the close button.
 * @param {string} [props.maxWidth="max-w-lg"] - Maximum width of the modal.
 *
 * @returns {JSX.Element|null}
 */
export default function Modal({
  isOpen,
  title,
  description,
  onClose,
  children,
  showCloseButton = true,
  maxWidth = "max-w-lg",
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={` w-full ${maxWidth} rounded-xl border border-stroke bg-background shadow-x `}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stroke p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>

            {description && (
              <p className="mt-1 text-sm text-text-secondary">{description}</p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className=" rounded-lg p-2 text-text-secondary transition hover:bg-surface hover:text-text-primary "
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
