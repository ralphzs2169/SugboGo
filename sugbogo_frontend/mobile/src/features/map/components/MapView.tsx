import { Platform } from "react-native";
import RNMapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapMarkerIcon from "./MapMarkerIcon";
import { HiddenGem } from "@/shared/constants/mockExploreData";

type Props = {
  gems: HiddenGem[];
  onMarkerPress: (gem: HiddenGem) => void;
};

export default function MapView({ gems, onMarkerPress }: Props) {
  return (
    <RNMapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 10.3157,
        longitude: 123.8854,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }}
      {...(Platform.OS === "android" && {
        mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
      })}
    >
      {gems.map((gem) => (
        <Marker
          key={gem.id}
          coordinate={{ latitude: gem.latitude, longitude: gem.longitude }}
          onPress={() => onMarkerPress(gem)}
        >
          <MapMarkerIcon category={gem.category} />
        </Marker>
      ))}
    </RNMapView>
  );
}