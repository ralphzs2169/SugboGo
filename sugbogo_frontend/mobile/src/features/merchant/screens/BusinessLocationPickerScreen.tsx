import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useState } from "react";
import { reverseGeocode } from "@/shared/api/googlePlaces.service";

import BusinessLocationMap from "../components/registration/BusinessLocationMap";
import BusinessLocationSearch from "../components/registration/BusinessLocationSearch";

type BusinessLocationPickerScreenProps = {
  initialLatitude: number | null;
  initialLongitude: number | null;
  onConfirm: (latitude: number, longitude: number, address: string) => void;
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
  initialLatitude,
  initialLongitude,
  onConfirm,
  onClose,
}: BusinessLocationPickerScreenProps) {
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(
    initialLatitude,
  );
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(
    initialLongitude,
  );
  const [selectedAddress, setSelectedAddress] = useState("");

  const hasSelectedLocation =
    selectedLatitude !== null && selectedLongitude !== null;

  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  function handleLocationSelect(
    latitude: number,
    longitude: number,
    address = "",
  ) {
    setSelectedLatitude(latitude);
    setSelectedLongitude(longitude);
    setSelectedAddress(address);
  }

  function handleConfirm() {
    if (!hasSelectedLocation) {
      return;
    }

    onConfirm(selectedLatitude, selectedLongitude, selectedAddress);
  }

  async function handleMapLocationSelect(latitude: number, longitude: number) {
    handleLocationSelect(latitude, longitude);
    setIsResolvingAddress(true);

    try {
      const address = await reverseGeocode(latitude, longitude);
      setSelectedAddress(address);
    } catch (error) {
      console.error("Failed to reverse geocode location:", error);
      setSelectedAddress("");
    } finally {
      setIsResolvingAddress(false);
    }
  }
  return (
    <View className="flex-1 bg-background">
      <View className="absolute left-4 right-4 top-4 z-10">
        <View className="mb-3 flex-row items-center">
          <Pressable
            onPress={onClose}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#1B4D3E"
            />
          </Pressable>

          <Text className="text-xl font-bold text-text-primary">
            Select Business Location
          </Text>
        </View>

        <BusinessLocationSearch onPlaceSelect={handleLocationSelect} />
      </View>

      <BusinessLocationMap
        latitude={selectedLatitude}
        longitude={selectedLongitude}
        onLocationSelect={handleMapLocationSelect}
        fullScreen
      />

      {hasSelectedLocation && (
        <View className="absolute bottom-5 left-4 right-4 rounded-2xl bg-white p-4 shadow-lg">
          <View className="flex-row items-start">
            <MaterialCommunityIcons
              name="map-marker"
              size={24}
              color="#F27F0D"
            />

            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-text-primary">
                Selected Location
              </Text>

              <Text className="mt-1 text-sm text-text-secondary">
                {isResolvingAddress
                  ? "Getting address..."
                  : selectedAddress || "Address unavailable"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleConfirm}
            className="mt-4 h-12 items-center justify-center rounded-xl bg-primary"
          >
            <Text className="text-base font-semibold text-white">
              Confirm Location
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
