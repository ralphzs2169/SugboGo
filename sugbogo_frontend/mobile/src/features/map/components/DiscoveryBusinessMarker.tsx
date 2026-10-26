import { useLayoutEffect, type ComponentProps } from "react";
import type { LatLng } from "react-native-maps";

import SnapshotMapMarker from "@/shared/components/map-related/SnapshotMapMarker";

type Props = ComponentProps<typeof SnapshotMapMarker> & {
  businessId: number;
  registerCoordinate: (
    businessId: number,
    coordinate: LatLng,
  ) => () => void;
};

/**
 * Registers only mounted business pins, including the library's spiral positions.
 * Business identity stays separate from the coordinate supplied by clustering.
 */
export default function DiscoveryBusinessMarker({
  businessId,
  coordinate,
  registerCoordinate,
  ...markerProps
}: Props) {
  useLayoutEffect(() => {
    return registerCoordinate(businessId, coordinate);
  }, [businessId, coordinate, registerCoordinate]);

  return <SnapshotMapMarker {...markerProps} coordinate={coordinate} />;
}
