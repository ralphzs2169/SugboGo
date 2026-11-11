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
  dismissDisabled = false,
  maxWidth = "max-w-lg",
  scrollable = false,
  lockBodyScroll = true,
  placement = "center",
  overlayClassName = "",
  panelClassName = "",
  bodyClassName = "",
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

    function handleKeyDown(event) {
      const activeDialog = document.activeElement?.closest('[role="dialog"]');
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        (!activeDialog || activeDialog === dialogRef.current)
      ) {
        if (!dismissDisabled) {
          onClose();
        }
      }

      const dialog = dialogRef.current;
      if (
        event.key !== "Tab" ||
        event.defaultPrevented ||
        document.activeElement?.closest('[role="dialog"]') !== dialog
      ) {
        return;
      }

      const controls = Array.from(
        dialog.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter(
        (control) =>
          control.tabIndex >= 0 &&
          !control.closest('[hidden], [inert], [aria-hidden="true"]'),
      );
      const first = controls[0];
      const last = controls.at(-1);

      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (lockBodyScroll) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [isOpen, onClose, lockBodyScroll, dismissDisabled]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/50 ${placement === "right" ? "items-stretch justify-end" : "items-center justify-center p-4"} ${overlayClassName}`}
      onClick={() => {
        if (!dismissDisabled) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`w-full ${maxWidth} ${placement === "right"
          ? "flex h-dvh min-h-0 flex-col border-l shadow-xl"
          : `${scrollable ? "max-h-[calc(100vh-2rem)]" : ""} rounded-xl border shadow-x`
        } overflow-hidden border-stroke bg-background outline-none focus-visible:ring-2 focus-visible:ring-stroke-active/30 ${panelClassName}`}
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
              disabled={dismissDisabled}
              className="cursor-pointer rounded-lg p-2 text-text-secondary transition hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div
          className={`${bodyClassName} ${
            placement === "right"
              ? "min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"
              : scrollable ? "max-h-[calc(100vh-10rem)] overflow-y-auto p-6" : "p-6"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
