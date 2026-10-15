import { useCallback, useRef, useState } from "react";

import type { MapBounds } from "../types/mapDiscovery.types";
import {
  hasViewportChanged,
  isSearchableBounds,
  normalizeBounds,
} from "../utils/mapViewport";

/** Keeps the viewed area separate from the explicitly searched area. */
export default function useMapViewport() {
  const [viewedBounds, setViewedBounds] = useState<MapBounds | null>(null);
  const [committedBounds, setCommittedBounds] = useState<MapBounds | null>(
    null,
  );
  const [isMoving, setIsMoving] = useState(false);
  const hasInitialSearch = useRef(false);

  const onViewportChange = useCallback((bounds: MapBounds, commit = false) => {
    const normalized = normalizeBounds(bounds);
    setViewedBounds(normalized);
    setIsMoving(false);

    if (
      (!hasInitialSearch.current || commit) &&
      isSearchableBounds(normalized)
    ) {
      hasInitialSearch.current = true;
      setCommittedBounds(normalized);
    } else if (commit) {
      setCommittedBounds(null);
    }
  }, []);

  const onViewportChanging = useCallback(() => {
    setIsMoving(true);
  }, []);

  const searchThisArea = useCallback(() => {
    if (viewedBounds && !isMoving && isSearchableBounds(viewedBounds)) {
      setCommittedBounds(viewedBounds);
    }
  }, [isMoving, viewedBounds]);

  const needsZoom = viewedBounds !== null && !isSearchableBounds(viewedBounds);
  const canSearch = Boolean(
    viewedBounds &&
    !isMoving &&
    !needsZoom &&
    (!committedBounds || hasViewportChanged(viewedBounds, committedBounds)),
  );

  return {
    committedBounds,
    viewedBounds,
    canSearch,
    needsZoom,
    isMoving,
    onViewportChange,
    onViewportChanging,
    searchThisArea,
  };
}
