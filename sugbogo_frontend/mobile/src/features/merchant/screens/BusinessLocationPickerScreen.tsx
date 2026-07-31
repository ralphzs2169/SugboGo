import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { reverseGeocode } from "@/shared/api/googlePlaces.service";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";

import BusinessLocationConfirmationSheet from "../components/registration/BusinessLocationConfirmationSheet";
import BusinessLocationMap from "../components/registration/BusinessLocationMap";
import BusinessLocationSearch from "../components/registration/BusinessLocationSearch";
import BusinessLocationEmptyState from "../components/registration/BusinessLocationEmptyState";

type BusinessLocationPickerScreenProps = {
  initialLocation: BusinessLocation | null;
  onConfirm: (location: BusinessLocation) => void;
  onClose: () => void;
};

/**
 * Provides a full-screen location picker for selecting
 * a business location through search or map interaction.
 *
 * The picker manages its selection locally and only commits
 * the location to the registration form after confirmation.
 */
export default function BusinessLocationPickerScreen({
  initialLocation,
  onConfirm,
  onClose,
}: BusinessLocationPickerScreenProps) {
  const [searchText, setSearchText] = useState("");

  // Keep the selected location local until the user confirms it.
  const [selectedLocation, setSelectedLocation] =
    useState<BusinessLocation | null>(initialLocation);

  const hasSelectedLocation = selectedLocation !== null;

  // Update the local selection when a place is chosen from search results.
  function handleLocationSelect(location: BusinessLocation) {
    setSelectedLocation(location);
  }

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Commit the selected location only after the user confirms it.
  function handleConfirm() {
    if (!selectedLocation) {
      return;
    }

    onConfirm(selectedLocation);
  }

  // Resolve the address when the user selects a location directly on the map.
  async function handleMapLocationSelect(latitude: number, longitude: number) {
    setSearchText("");
    setIsResolvingAddress(true);

    try {
      const location = await reverseGeocode(latitude, longitude);
      setSelectedLocation(location);
    } catch (error) {
      console.error("Failed to reverse geocode location:", error);

      // Keep the selected coordinates even if address resolution fails.
      setSelectedLocation({
        latitude,
        longitude,
        formattedAddress: "",
        province: "",
        city: "",
        barangay: "",
        streetAddress: "",
      });
    } finally {
      setIsResolvingAddress(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* Keep navigation and search controls below the device status bar. */}
      <SafeAreaView
        edges={["top"]}
        className="absolute left-0 right-0 top-0 z-10"
      >
        <View className="px-4 pt-2">
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#1B4D3E"
            />
          </Pressable>

          <BusinessLocationSearch
            value={searchText}
            onChangeText={setSearchText}
            onPlaceSelect={handleLocationSelect}
          />
        </View>
      </SafeAreaView>

      {/* The map fills the entire screen behind the overlay controls. */}
      <BusinessLocationMap
        latitude={selectedLocation?.latitude ?? null}
        longitude={selectedLocation?.longitude ?? null}
        onLocationSelect={handleMapLocationSelect}
        fullScreen
      />

      {/* Guide the user when no location has been selected yet. */}
      {!hasSelectedLocation && <BusinessLocationEmptyState />}

      {/* Show the selected address and confirmation action after a location is selected. */}
      {hasSelectedLocation && (
        <BusinessLocationConfirmationSheet
          address={selectedLocation?.formattedAddress || "Address unavailable"}
          isResolvingAddress={isResolvingAddress}
          onConfirm={handleConfirm}
        />
      )}
    </View>
  );
}
