import {
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  useWindowDimensions,
  type LayoutChangeEvent,
  type View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Viewport = Pick<SpotlightRect, "width" | "height">;
type Measurement = { layoutKey: string; targets: Map<string, SpotlightRect> };

function isWithinViewport(rect: SpotlightRect, viewport: Viewport) {
  return (
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= viewport.width + 1 &&
    rect.y + rect.height <= viewport.height + 1
  );
}

/** Measures registered native targets relative to the overlay's own container. */
export function useSpotlightTargets(
  names: readonly string[],
  enabled: boolean,
) {
  const container = useRef<View>(null);
  const nodes = useRef(new Map<string, View>());
  const [revision, advanceLayout] = useReducer((value: number) => value + 1, 0);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const { width, height, scale, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const layoutKey = [
    revision,
    viewport.width,
    viewport.height,
    width,
    height,
    scale,
    fontScale,
    insets.top,
    insets.right,
    insets.bottom,
    insets.left,
  ].join(":");

  const setTarget = useCallback((name: string, node: View | null) => {
    if (node) {
      nodes.current.set(name, node);
    } else {
      nodes.current.delete(name);
    }
  }, []);

  // Ref callbacks only register nodes. Native layout events trigger measurement
  // after the host has attached, including when a tab pressable remounts.
  const invalidateLayout = useCallback(() => {
    if (container.current) advanceLayout();
  }, []);

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    if (!container.current) return;
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => {
      if (current.width === width && current.height === height) return current;
      return { width, height };
    });
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      // A newly focused tab bar needs a fresh measurement before playback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMeasurement(null);
      return;
    }
    if (viewport.width <= 0 || viewport.height <= 0) return;

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const host = container.current;
      if (!host) return;

      const targets = new Map<string, SpotlightRect>();
      const measuredNodes = new Map(nodes.current);
      for (const name of names) {
        const node = measuredNodes.get(name);
        if (!node) return;

        node.measureLayout(host, (x, y, width, height) => {
          if (
            cancelled ||
            container.current !== host ||
            nodes.current.get(name) !== node
          ) {
            return;
          }

          const rect = { x, y, width, height };
          if (!isWithinViewport(rect, viewport)) return;

          targets.set(name, rect);
          if (
            targets.size === names.length &&
            names.every(
              (targetName) =>
                nodes.current.get(targetName) === measuredNodes.get(targetName),
            )
          ) {
            setMeasurement({ layoutKey, targets });
          }
        });
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [enabled, layoutKey, names, viewport]);

  return {
    container,
    onContainerLayout,
    viewport,
    setTarget,
    invalidateLayout,
    targets:
      enabled && measurement?.layoutKey === layoutKey
        ? measurement.targets
        : null,
  };
}
