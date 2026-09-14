import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/**
 * Reusable modal dialog.
 *
 * Supports optional scrollable content and lets an enclosing overlay retain
 * body-scroll ownership when dialogs are nested inside drawers.
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
  lockBodyScroll = true,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const animationFrame = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(animationFrame);

      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    if (lockBodyScroll) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);

      if (lockBodyScroll) {
        document.body.style.overflow = "";
      }
    };
  }, [isOpen, onClose, lockBodyScroll]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`w-full ${maxWidth} ${
          scrollable ? "max-h-[calc(100vh-2rem)]" : ""
        } overflow-hidden rounded-xl border border-stroke bg-background shadow-x outline-none focus-visible:ring-2 focus-visible:ring-stroke-active/30`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-stroke p-6">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-text-primary"
            >
              {title}
            </h2>

            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-text-secondary"
              >
                {description}
              </p>
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
