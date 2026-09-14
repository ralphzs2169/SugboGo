import { useEffect } from "react";

function isEditableTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    ),
  );
}

function hasOpenDialog() {
  return Boolean(
    document.querySelector('[role="dialog"][aria-modal="true"]'),
  );
}

/**
 * Adds safe workspace-level geometry Undo and editing-cancel shortcuts while
 * preserving native form Undo, dialog ownership, and browser fullscreen Escape.
 */
export default function useTransitWorkspaceKeyboardShortcuts({
  isRouteGeometryMode,
  canUndoGeometry,
  isEditing,
  isOverlayOpen,
  onUndoGeometry,
  onRequestCancel,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (isOverlayOpen || hasOpenDialog() || event.repeat) {
        return;
      }

      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z";

      if (isUndo) {
        if (
          isRouteGeometryMode &&
          canUndoGeometry &&
          !isEditableTarget(event.target)
        ) {
          event.preventDefault();
          onUndoGeometry();
        }

        return;
      }

      if (
        event.key === "Escape" &&
        isEditing &&
        !document.fullscreenElement &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        onRequestCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    canUndoGeometry,
    isEditing,
    isOverlayOpen,
    isRouteGeometryMode,
    onRequestCancel,
    onUndoGeometry,
  ]);
}
