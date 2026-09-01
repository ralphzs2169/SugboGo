import { View, Alert } from "react-native";
import { useState, useRef } from "react";
import * as Location from "expo-location";
import MapView from "../components/MapView";
// import MapTopBar from "../components/MapTopBar"; //
import MapSearchOverlay from "../components/MapSearchOverlay";
import MapControls from "../components/MapControls";
import MSMEPreviewCard from "../components/MSMEPreviewCard";
import { MOCK_HIDDEN_GEMS, HiddenGem } from "@/shared/constants/mockExploreData";
import RNMapView from "react-native-maps";

export default function MapScreen() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedGem, setSelectedGem] = useState<HiddenGem | null>(null);
  const mapInstanceRef = useRef<RNMapView | null>(null);

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((f) => f !== label) : [...prev, label]
    );
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.getCamera().then((camera) => {
      mapInstanceRef.current?.animateCamera({ zoom: (camera.zoom ?? 12) + 1 });
    });
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.getCamera().then((camera) => {
      mapInstanceRef.current?.animateCamera({ zoom: (camera.zoom ?? 12) - 1 });
    });
  };

  const handleLocateMe = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Location Permission Needed",
        "SugboGo needs location access to show you nearby hidden gems."
      );
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      mapInstanceRef.current?.animateToRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch (error) {
      Alert.alert("Location Error", "Could not get your current location. Please try again.");
    }
  };

  return (
    <View className="flex-1"> 
      {/* <MapTopBar /> */}

      <View className="flex-1">
        <MapView
          gems={MOCK_HIDDEN_GEMS}
          selectedGemId={selectedGem?.id ?? null}
          onMarkerPress={(gem) => setSelectedGem(gem)}
          onMapReady={(map) => {
            mapInstanceRef.current = map;
          }}
        />
        <MapSearchOverlay activeFilters={activeFilters} onToggleFilter={toggleFilter} />
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocateMe={handleLocateMe}
          isPreviewCardOpen={!!selectedGem}
        />

        {selectedGem && (
          <MSMEPreviewCard
            gem={selectedGem}
            onClose={() => setSelectedGem(null)}
            onVisitProfile={() => {}}
          />
        )}
      </View>
    </View>
  );
}