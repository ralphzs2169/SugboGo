import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import { Platform, View, type LayoutChangeEvent } from "react-native";
import { Marker, type MapMarker, type MapMarkerProps } from "react-native-maps";

import { MAP_MARKER_FALLBACK_IMAGE } from "@/shared/constants/mapMarkerSnapshot";

type Props = MapMarkerProps & {
  markerRef?: Ref<MapMarker>;
  snapshotKey: string;
  /** Read by the clustering wrapper before this component renders its marker. */
  cluster?: boolean;
};

/**
 * Refreshes custom marker snapshots after layout and appearance changes.
 *
 * Android uses a transparent native fallback instead of flashing Google's pin
 * while custom children attach or detach. Markers retain their intended opacity.
 */
export default function SnapshotMapMarker({
  markerRef,
  snapshotKey,
  cluster: _cluster,
  children,
  image,
  tracksViewChanges = false,
  ...markerProps
}: Props) {
  const nativeMarkerRef = useRef<MapMarker | null>(null);
  const hasLayout = useRef(false);
  const pendingFrame = useRef<number | null>(null);

  useImperativeHandle(markerRef, () => nativeMarkerRef.current!, []);

  const cancelRedraw = useCallback(() => {
    if (pendingFrame.current !== null) {
      cancelAnimationFrame(pendingFrame.current);
      pendingFrame.current = null;
    }
  }, []);

  const redrawSnapshot = useCallback(() => {
    if (!hasLayout.current) {
      return;
    }

    cancelRedraw();
    pendingFrame.current = requestAnimationFrame(() => {
      nativeMarkerRef.current?.redraw();

      // Capture the settled child layout without continuously rebuilding bitmaps.
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = null;
        nativeMarkerRef.current?.redraw();
      });
    });
  }, [cancelRedraw]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;

      if (width > 0 && height > 0) {
        hasLayout.current = true;
        redrawSnapshot();
      }
    },
    [redrawSnapshot],
  );

  useEffect(() => {
    redrawSnapshot();
    return cancelRedraw;
  }, [cancelRedraw, redrawSnapshot, snapshotKey]);

  return (
    <Marker
      {...markerProps}
      ref={nativeMarkerRef}
      image={
        image ??
        (Platform.OS === "android" ? MAP_MARKER_FALLBACK_IMAGE : undefined)
      }
      tracksViewChanges={tracksViewChanges}
    >
      {/* Keep the complete custom view attached for native bitmap capture. */}
      <View collapsable={false} onLayout={handleLayout}>
        {children}
      </View>
    </Marker>
  );
}
