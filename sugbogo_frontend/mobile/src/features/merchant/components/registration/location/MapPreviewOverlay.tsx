import { Pressable, View } from "react-native";
import { ReactNode } from "react";

import MapPreviewEmptyState from "./MapPreviewEmptyState";
import MapPreviewSelectedState from "./MapPreviewSelectedState";
import MapLoadingOverlay from "./MapLoadingOverlay";

type Props = {
  children: ReactNode; // the MapView itself
  isMapReady: boolean;
  hasSelectedLocation: boolean;
  onPress: () => void;
  onOverlayLayout: (height: number) => void;
};

/**
 * Wraps a preview-mode map with a tap target and the loading /
 * empty / selected overlays shown on top of it.
 */
export default function LocationMapPreviewOverlay({
  children,
  isMapReady,
  hasSelectedLocation,
  onPress,
  onOverlayLayout,
}: Props) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          className="relative overflow-hidden rounded-2xl"
          style={{ opacity: pressed ? 0.85 : 1 }}
        >
          {children}
          <View pointerEvents="box-only" className="absolute inset-0" />

          <MapLoadingOverlay visible={!isMapReady} />

          {hasSelectedLocation ? (
            <View
              className="absolute inset-x-0 bottom-0"
              onLayout={(e) => onOverlayLayout(e.nativeEvent.layout.height)}
            >
              <MapPreviewSelectedState />
            </View>
          ) : (
            <MapPreviewEmptyState />
          )}
        </View>
      )}
    </Pressable>
  );
}
