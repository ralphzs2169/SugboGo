import MapView, {
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { useRef } from "react";

type Props = {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect: (latitude: number, longitude: number) => void;
};

export default function BusinessLocationMap({
  latitude,
  longitude,
  onLocationSelect,
}: Props) {
  const mapRef = useRef<MapView>(null);

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    onLocationSelect(latitude, longitude);
  }

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={{ height: 360, width: "100%", borderRadius: 24 }}
      onPress={handleMapPress}
      initialRegion={{
        latitude: 10.3157,
        longitude: 123.8854,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {latitude !== null && longitude !== null && (
        <Marker
          coordinate={{
            latitude,
            longitude,
          }}
        />
      )}
    </MapView>
  );
}
