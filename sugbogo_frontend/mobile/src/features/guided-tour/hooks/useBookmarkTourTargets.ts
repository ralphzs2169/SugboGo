import {
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useWindowDimensions, type View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SpotlightRect } from "./useSpotlightTargets";

export type BookmarkSurface = {
  getViewport: () => View | null;
  getParentViewport?: () => View | null;
  route: string;
  blocked: boolean;
};

export type BookmarkAnchor = {
  node: View;
  surface: BookmarkSurface;
};

type MeasurementCallback = (
  x: number,
  y: number,
  width: number,
  height: number,
) => void;

type Target = {
  anchor: BookmarkAnchor;
  rect: SpotlightRect;
  revision: number;
  layoutKey: string;
};
const SCROLL_SETTLE_MS = 240;

function contains(outer: SpotlightRect, inner: SpotlightRect) {
  return (
    [inner.x, inner.y, inner.width, inner.height].every(Number.isFinite) &&
    inner.width > 0 &&
    inner.height > 0 &&
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

type Options = {
  enabled: boolean;
  scope: string;
  pathname: string;
  container: { current: View | null };
  viewport: Pick<SpotlightRect, "width" | "height">;
  tabBarTop?: number;
  activeAnchor?: BookmarkAnchor;
};

/** Finds a fully visible bookmark in the focused, stationary discovery list. */
export function useBookmarkTourTargets({
  enabled,
  scope,
  pathname,
  container,
  viewport,
  tabBarTop,
  activeAnchor,
}: Options) {
  const anchors = useRef(new Set<BookmarkAnchor>());
  const [revision, advance] = useReducer((value: number) => value + 1, 0);
  const [scrollingRoute, setScrollingRoute] = useState<string | null>(null);
  const busy = scrollingRoute === pathname;
  const [target, setTarget] = useState<Target | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const frame = useRef<number | undefined>(undefined);
  const touchedSurface = useRef<BookmarkSurface | null>(null);
  const scrollEpoch = useRef(0);
  const { width, height } = useWindowDimensions();
  const { top, bottom, left, right } = useSafeAreaInsets();
  const layoutKey = [
    scope,
    pathname,
    width,
    height,
    viewport.width,
    viewport.height,
    tabBarTop,
    top,
    bottom,
    left,
    right,
  ].join(":");

  const refresh = useCallback(() => {
    if (!container.current) return;
    scrollEpoch.current += 1;
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (container.current) advance();
    });
  }, [container]);

  const register = useCallback(
    (anchor: BookmarkAnchor) => {
      anchors.current.add(anchor);
      refresh();
      return () => {
        anchors.current.delete(anchor);
        refresh();
      };
    },
    [refresh],
  );

  const markScroll = useCallback(
    (surface: BookmarkSurface) => {
      if (!container.current) return;

      scrollEpoch.current += 1;
      setScrollingRoute(surface.route);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (container.current && touchedSurface.current !== surface) {
          setScrollingRoute(null);
          refresh();
        }
      }, SCROLL_SETTLE_MS);
    },
    [container, refresh],
  );

  const markTouch = useCallback(
    (surface: BookmarkSurface, touching: boolean) => {
      if (touching) {
        touchedSurface.current = surface;
      } else if (touchedSurface.current === surface) {
        touchedSurface.current = null;
      }
      markScroll(surface);
    },
    [markScroll],
  );

  const releaseTouch = useCallback(
    (surface: BookmarkSurface) => {
      if (touchedSurface.current === surface) markTouch(surface, false);
    },
    [markTouch],
  );

  useLayoutEffect(() => {
    return () => {
      clearTimeout(idleTimer.current);
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      frame.current = undefined;
      touchedSurface.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!enabled || busy || viewport.width <= 0 || viewport.height <= 0) return;
    if (pathname === "/explore" && tabBarTop === undefined) return;

    const epoch = scrollEpoch.current;
    let cancelled = false;
    const host = container.current;
    if (!host) return;

    const isCurrent = () =>
      !cancelled && container.current === host && scrollEpoch.current === epoch;

    const measureFrame = requestAnimationFrame(() => {
      host.measureInWindow((hostX, hostY) => {
        if (!isCurrent()) return;

        const safeViewport = {
          x: hostX + left,
          y: hostY + top,
          width: viewport.width - left - right,
          height: (tabBarTop ?? viewport.height - bottom) - top,
        };
        const measuringLists = new Map<
          View,
          {
            bounds?: SpotlightRect;
            callbacks: MeasurementCallback[];
          }
        >();
        const measureList = (node: View, callback: MeasurementCallback) => {
          const cached = measuringLists.get(node);
          if (cached?.bounds) {
            const { x, y, width, height } = cached.bounds;
            callback(x, y, width, height);
            return;
          }
          if (cached) {
            cached.callbacks.push(callback);
            return;
          }

          const entry: NonNullable<ReturnType<typeof measuringLists.get>> = {
            callbacks: [callback],
          };
          measuringLists.set(node, entry);
          node.measureInWindow((x, y, width, height) => {
            if (!isCurrent()) return;
            entry.bounds = { x, y, width, height };
            for (const resolve of entry.callbacks) resolve(x, y, width, height);
          });
        };
        let found = false;
        for (const anchor of anchors.current) {
          const { surface } = anchor;
          const list = surface.getViewport();
          const parentList = surface.getParentViewport?.();
          if (!list || surface.blocked || surface.route !== pathname) continue;
          if (surface.getParentViewport && !parentList) continue;
          if (activeAnchor && activeAnchor !== anchor) continue;

          const measureAnchor = (parentBounds?: SpotlightRect) => {
            measureList(list, (x, y, width, height) => {
              if (found || !isCurrent()) return;
              const listBounds = { x, y, width, height };
              if (
                y >= safeViewport.y + safeViewport.height ||
                y + height <= safeViewport.y
              ) {
                return;
              }
              anchor.node.measureInWindow((x, y, width, height) => {
                if (
                  found ||
                  !isCurrent() ||
                  !anchors.current.has(anchor) ||
                  surface.getViewport() !== list ||
                  surface.getParentViewport?.() !== parentList
                ) {
                  return;
                }

                const bounds = { x, y, width, height };
                if (
                  !contains(listBounds, bounds) ||
                  !contains(safeViewport, bounds) ||
                  (parentBounds && !contains(parentBounds, bounds))
                ) {
                  return;
                }

                found = true;
                setTarget({
                  anchor,
                  revision,
                  layoutKey,
                  rect: { ...bounds, x: x - hostX, y: y - hostY },
                });
              });
            });
          };
          if (parentList) {
            measureList(parentList, (x, y, width, height) => {
              if (isCurrent()) measureAnchor({ x, y, width, height });
            });
          } else {
            measureAnchor();
          }
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(measureFrame);
    };
  }, [
    activeAnchor,
    bottom,
    busy,
    container,
    enabled,
    layoutKey,
    left,
    pathname,
    revision,
    right,
    tabBarTop,
    top,
    viewport,
  ]);

  const candidate =
    enabled &&
    !busy &&
    target?.revision === revision &&
    target.layoutKey === layoutKey &&
    target.anchor.surface.route === pathname
      ? target
      : null;

  return { candidate, register, refresh, markScroll, markTouch, releaseTouch };
}
