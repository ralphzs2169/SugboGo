import { useRef } from "react";

const GUARD_BUFFER_MS = 100;

/**
 * Prevents a map's onPress from firing as a result of an in-progress
 * programmatic camera animation (e.g. animateToRegion), rather than
 * a real user tap.
 */
export default function useMapPressGuard() {
  const isActive = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Call this right before starting a programmatic animation, passing
  // its duration — the guard stays active slightly longer than the
  // animation to account for the map event firing just after it ends.
  function activate(durationMs: number) {
    isActive.current = true;

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = setTimeout(() => {
      isActive.current = false;
    }, durationMs + GUARD_BUFFER_MS);
  }

  function isGuardActive() {
    return isActive.current;
  }

  function clear() {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
  }

  return { activate, isGuardActive, clear };
}
