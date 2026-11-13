import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { View } from "react-native";

import { useExplorerTour } from "./useExplorerTour";
import type { BookmarkSurface } from "./useBookmarkTourTargets";

export const BookmarkTourSurfaceContext = createContext<BookmarkSurface | null>(
  null,
);

/** Connects a discovery list's clipping bounds and gestures to the bookmark tour. */
export function useBookmarkTourSurface(
  route: string | null,
  blocked = false,
  getParentViewport?: BookmarkSurface["getViewport"],
) {
  const tour = useExplorerTour()?.bookmark;
  // Keep native layout access behind callbacks, outside React render.
  const [viewport] = useState(() => {
    let view: View | null = null;
    let list: { getNativeScrollRef: () => unknown } | null = null;
    return {
      get: () => {
        const node = list?.getNativeScrollRef?.() as View | null | undefined;
        return node ?? view;
      },
      attachView: (node: View | null) => {
        view = node;
      },
      attachList: (node: typeof list) => {
        list = node;
      },
    };
  });
  const surface = useMemo(
    () => ({
      getViewport: viewport.get,
      getParentViewport,
      route: route ?? "",
      blocked: blocked || !route,
    }),
    [route, blocked, getParentViewport, viewport],
  );
  const onScroll = useCallback(() => {
    if (route) tour?.markScroll(surface);
  }, [route, surface, tour]);
  const onTouchStart = useCallback(() => {
    if (route) tour?.markTouch(surface, true);
  }, [route, surface, tour]);
  const onTouchEnd = useCallback(() => {
    if (route) tour?.markTouch(surface, false);
  }, [route, surface, tour]);

  useEffect(() => {
    return () => tour?.releaseTouch(surface);
  }, [surface, tour]);

  return {
    attachViewport: viewport.attachList,
    attachNativeViewport: viewport.attachView,
    surface,
    onLayout: tour?.refresh,
    onScroll,
    onTouchStart,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
    onContentSizeChange: tour?.refresh,
  };
}
