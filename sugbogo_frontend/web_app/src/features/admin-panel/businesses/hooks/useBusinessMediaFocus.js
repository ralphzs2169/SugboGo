import { useEffect } from "react";

/** Retain keyboard focus inside the current media dialog and restore its connected opener. */
export default function useBusinessMediaFocus(dialogRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    function trap(event) {
      const dialog = dialogRef.current;
      if (event.key !== "Tab" || !dialog?.contains(document.activeElement))
        return;
      const controls = [
        ...dialog.querySelectorAll(
          "button:not(:disabled), a[href], [tabindex='0']",
        ),
      ];
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
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [dialogRef, enabled]);
}
