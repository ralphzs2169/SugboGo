import MapView, {
  Marker,
  MapPressEvent,
  PROVIDER_GOOGLE,
} from "react-native-maps";

type BusinessLocationMapProps = {
  latitude: number | null;
  longitude: number | null;
  onLocationSelect: (latitude: number, longitude: number) => void;
};

export default function BusinessLocationMap({
  latitude,
  longitude,
  onLocationSelect,
}: BusinessLocationMapProps) {
  const hasSelectedLocation = latitude !== null && longitude !== null;

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    onLocationSelect(latitude, longitude);
  }

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      className="h-56 w-full"
      onPress={handleMapPress}
      initialRegion={{
        latitude: 10.3157,
        longitude: 123.8854,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {hasSelectedLocation && (
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
