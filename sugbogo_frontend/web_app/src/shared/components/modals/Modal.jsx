import { X } from "lucide-react";
import { useEffect } from "react";

/**
 * Reusable modal dialog.
 *
 * Supports optional scrollable content for forms or dialogs that may exceed
 * the available viewport height.
 */
export default function Modal({
  isOpen,
  title,
  description,
  onClose,
  children,
  showCloseButton = true,
  maxWidth = "max-w-lg",
  scrollable = false,
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
        className={`w-full ${maxWidth} ${
          scrollable ? "max-h-[calc(100vh-2rem)]" : ""
        } overflow-hidden rounded-xl border border-stroke bg-background shadow-x`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-stroke p-6">
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
              className="cursor-pointer rounded-lg p-2 text-text-secondary transition hover:bg-surface hover:text-text-primary"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div
          className={
            scrollable ? "max-h-[calc(100vh-10rem)] overflow-y-auto p-6" : "p-6"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
