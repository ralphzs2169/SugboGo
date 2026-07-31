import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useState, useRef } from "react";
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
  // Search bar state
  const [searchText, setSearchText] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Selected location state
  const [selectedLocation, setSelectedLocation] =
    useState<BusinessLocation | null>(initialLocation);
  const hasSelectedLocation = selectedLocation !== null;
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Tracks each location selection attempt with a growing number, so if an
  // older request's data comes back after a newer one, we can tell it's stale and ignore it.
  const selectionRequestId = useRef(0);

  // Update the local selection when a place is chosen from search results.
  function handleLocationSelect(location: BusinessLocation) {
    ++selectionRequestId.current; // invalidate any in-flight map selection
    setSelectedLocation(location);
  }

  // Resolve the address when the user selects a location directly on the map.
  async function handleMapLocationSelect(latitude: number, longitude: number) {
    const requestId = ++selectionRequestId.current;
    setSearchText("");
    setIsResolvingAddress(true);

    try {
      const location = await reverseGeocode(latitude, longitude);

      if (requestId !== selectionRequestId.current) {
        return; // a newer selection (search or another tap) has since happened — discard
      }

      setSelectedLocation(location);
    } catch (error) {
      console.error("Failed to reverse geocode location:", error);

      if (requestId === selectionRequestId.current) {
        setSelectedLocation({
          latitude,
          longitude,
          formattedAddress: "",
          province: "",
          city: "",
          barangay: "",
          streetAddress: "",
        });
      }
    } finally {
      setIsResolvingAddress(false);
    }
  }

  // Commit the selected location only after the user confirms it.
  function handleConfirm() {
    if (!selectedLocation) {
      return;
    }

    onConfirm(selectedLocation);
  }

  return (
    <View className="flex-1 bg-background">
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
            onSuggestionsVisibleChange={setSuggestionsOpen}
          />
        </View>
      </SafeAreaView>

      <BusinessLocationMap
        latitude={selectedLocation?.latitude ?? null}
        longitude={selectedLocation?.longitude ?? null}
        onLocationSelect={suggestionsOpen ? undefined : handleMapLocationSelect}
        fullScreen
      />

      {!hasSelectedLocation && <BusinessLocationEmptyState />}

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
