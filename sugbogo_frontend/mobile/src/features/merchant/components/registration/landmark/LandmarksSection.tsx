import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useFormContext } from "react-hook-form";
import { router } from "expo-router";
import { useEffect } from "react";
import LandmarkCard from "./LandmarkCard";
import LandmarksEmptyState from "./LandmarksEmptyState";
import LandmarkCapacityHint from "./LandmarkCapacityHint";

import RegistrationSection from "../RegistrationSection";
import { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";

const MAX_SELECTED_LANDMARKS = 5;

/**
 * Displays nearby landmark suggestions for the merchant's
 * confirmed business location.
 *
 * Google-detected landmarks can be selected directly from
 * the registration form. Merchants may select up to five
 * landmarks in total.
 *
 * Custom landmarks can be added through the dedicated
 * landmark picker.
 */
export default function LandmarksSection() {
  const { setValue } = useFormContext<MerchantRegistrationForm>();

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  const setSelectedLandmarks = useMerchantRegistrationStore(
    (state) => state.setSelectedLandmarks,
  );

  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const remainingLandmarks = MAX_SELECTED_LANDMARKS - selectedLandmarks.length;

  useEffect(() => {
    setValue("landmarks", selectedLandmarks);
  }, [selectedLandmarks, setValue]);

  function handleRemoveLandmark(id: string) {
    setSelectedLandmarks(
      selectedLandmarks.filter((landmark) => landmark.id !== id),
    );
  }
  /**
   * Opens the dedicated picker for selecting a custom landmark.
   */
  function handlePickCustomLandmark() {
    router.push("/(explorer)/merchant-registration/landmarks-picker");
  }

  return (
    <RegistrationSection
      icon="map-marker-radius-outline"
      title="Nearby Landmarks"
      description="Help explorers find your business."
    >
      {selectedLandmarks.length === 0 ? (
        <LandmarksEmptyState />
      ) : (
        <View className="gap-2">
          {selectedLandmarks.map((landmark) => (
            <LandmarkCard
              key={landmark.id}
              landmark={landmark}
              onRemove={handleRemoveLandmark}
            />
          ))}
        </View>
      )}

      {remainingLandmarks > 0 && (
        <LandmarkCapacityHint
          remaining={remainingLandmarks}
          max={MAX_SELECTED_LANDMARKS}
        />
      )}
      <Pressable
        onPress={handlePickCustomLandmark}
        disabled={
          !selectedLocation ||
          selectedLandmarks.length >= MAX_SELECTED_LANDMARKS
        }
        className="mt-3 flex-row items-center justify-center rounded-xl border border-gray-200 px-4 py-3"
        style={{
          opacity:
            !selectedLocation ||
            selectedLandmarks.length >= MAX_SELECTED_LANDMARKS
              ? 0.45
              : 1,
        }}
      >
        <MaterialCommunityIcons
          name="map-marker-plus-outline"
          size={20}
          color="#1B4D3E"
        />

        <Text className="ml-2 text-sm font-semibold text-text-primary">
          Add custom landmark
        </Text>
      </Pressable>

      <Text className="mt-3 text-center text-xs font-medium text-text-secondary">
        Selected: {selectedLandmarks.length} / {MAX_SELECTED_LANDMARKS}
      </Text>
    </RegistrationSection>
  );
}
