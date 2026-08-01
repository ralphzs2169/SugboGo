import { View } from "react-native";
import { useState, useRef } from "react";

import { reverseGeocode } from "@/shared/api/googlePlaces.service";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";

import LocationPickerHeader from "../components/registration/location/LocationPickerHeader";
import LocationConfirmationSheet from "../components/registration/location/LocationConfirmationSheet";
import LocationMap from "../components/registration/location/LocationMap";
import LocationSelectionInfoSheet from "../components/registration/location/LocationSelectionInfoSheet";

type BusinessLocationPickerScreenProps = {
  initialLocation: BusinessLocation | null;
  onConfirm: (location: BusinessLocation) => void;
  onClose: () => void;
  isConfirming: boolean;
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
  isConfirming,
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
      <LocationPickerHeader
        value={searchText}
        onChangeText={setSearchText}
        onPlaceSelect={handleLocationSelect}
        onSuggestionsVisibleChange={setSuggestionsOpen}
        onClose={onClose}
      />

      <LocationMap
        latitude={selectedLocation?.latitude ?? null}
        longitude={selectedLocation?.longitude ?? null}
        onLocationSelect={
          suggestionsOpen || isConfirming ? undefined : handleMapLocationSelect
        }
        interactionEnabled={!isConfirming}
        fullScreen
      />

      {!hasSelectedLocation && <LocationSelectionInfoSheet />}

      {hasSelectedLocation && (
        <LocationConfirmationSheet
          address={selectedLocation?.formattedAddress || "Address unavailable"}
          isResolvingAddress={isResolvingAddress}
          onConfirm={handleConfirm}
          isConfirming={isConfirming}
        />
      )}
    </View>
  );
}
