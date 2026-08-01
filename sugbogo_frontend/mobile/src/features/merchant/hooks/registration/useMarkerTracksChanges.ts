import { useEffect, useState } from "react";

const RETRACK_WINDOW_MS = 500;

/**
 * Custom map markers are rendered once into a native bitmap by default.
 * This briefly forces re-tracking whenever the marker first appears, so
 * its shape/shadow have a chance to fully lay out before the final
 * snapshot, then stops tracking again for performance.
 */
export default function useMarkerTracksChanges(shouldTrack: boolean) {
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    if (!shouldTrack) {
      return;
    }

    setTracksChanges(true);

    const timeout = setTimeout(() => {
      setTracksChanges(false);
    }, RETRACK_WINDOW_MS);

    return () => clearTimeout(timeout);
  }, [shouldTrack]);

  return tracksChanges;
}
