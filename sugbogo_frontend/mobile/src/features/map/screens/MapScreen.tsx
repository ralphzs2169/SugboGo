import { View } from "react-native";
import { useState } from "react";
import MapView from "../components/MapView";
import MapTopBar from "../components/MapTopBar";
import MapSearchOverlay from "../components/MapSearchOverlay";
import { MOCK_HIDDEN_GEMS } from "@/shared/constants/mockExploreData";

export default function MapScreen() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) =>
      prev.includes(label) ? prev.filter((f) => f !== label) : [...prev, label]
    );
  };

  return (
    <View className="flex-1">
      <MapTopBar />

      <View className="flex-1">
        <MapView
          gems={MOCK_HIDDEN_GEMS}
          onMarkerPress={(gem) => {
            console.log("Tapped:", gem.name);
          }}
        />
        <MapSearchOverlay activeFilters={activeFilters} onToggleFilter={toggleFilter} />
      </View>
    </View>
  );
}