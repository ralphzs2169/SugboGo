import { Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";
import type { ExploreBusinessLocation } from "../../types/exploreBusiness.types";

type Props = {
  location: ExploreBusinessLocation;
  interactive?: boolean;
  bottomInset?: number;
};

/** Shares the established business-map treatment without requesting the user's location. */
export default function BusinessLocationMap({
  location,
  interactive = false,
  bottomInset = 0,
}: Props) {
  const { latitude, longitude } = location;
  return (
    <MapView
      key={`${latitude}:${longitude}`}
      provider={PROVIDER_GOOGLE}
      customMapStyle={Platform.OS === "ios" ? MAP_STYLE : undefined}
      googleMapId={
        Platform.OS === "android"
          ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID
          : undefined
      }
      style={{ width: "100%", height: "100%" }}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }}
      mapPadding={{ top: 0, left: 0, right: 0, bottom: bottomInset }}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={false}
      zoomControlEnabled={false}
      toolbarEnabled={false}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
    >
      <Marker
        coordinate={{ latitude, longitude }}
        tracksViewChanges
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <MapMarker variant="business" />
      </Marker>
    </MapView>
  );
}
