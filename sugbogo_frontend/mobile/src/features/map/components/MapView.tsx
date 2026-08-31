import { useRef, useImperativeHandle, forwardRef } from "react";
import { Platform } from "react-native";
import RNMapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapMarkerIcon from "./MapMarkerIcon";
import { HiddenGem } from "@/shared/constants/mockExploreData";

type Props = {
  gems: HiddenGem[];
  selectedGemId: string | null;
  onMarkerPress: (gem: HiddenGem) => void;
  onMapReady?: (map: RNMapView) => void;
};

export default function MapView({ gems, selectedGemId, onMarkerPress, onMapReady }: Props) {
  const internalRef = useRef<RNMapView>(null);

  return (
    <RNMapView
      ref={(instance) => {
        internalRef.current = instance;
        if (instance && onMapReady) {
          onMapReady(instance);
        }
      }}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      userInterfaceStyle="light"
      initialRegion={{
        latitude: 10.3157,
        longitude: 123.8854,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }}
      showsUserLocation
      {...(Platform.OS === "android" && {
        mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
      })}
    >
      {gems.map((gem) => (
        <Marker
          key={gem.id}
          coordinate={{ latitude: gem.latitude, longitude: gem.longitude }}
          onPress={() => onMarkerPress(gem)}
          opacity={selectedGemId && selectedGemId !== gem.id ? 0.35 : 1}
          zIndex={selectedGemId === gem.id ? 999 : 1}
        >
          <MapMarkerIcon category={gem.category} isSelected={selectedGemId === gem.id} />
        </Marker>
      ))}
    </RNMapView>
  );
}