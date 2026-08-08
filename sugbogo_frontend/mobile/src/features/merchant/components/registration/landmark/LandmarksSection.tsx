import { theme } from "@/constants/theme";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Text, View } from "react-native";
import { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import RegistrationSection from "../RegistrationSection";
import CapacityHint from "./CapacityHint";
import DisabledSelectionState from "./DisabledSelectionState";
import LandmarkCard from "./LandmarkCard";
import LandmarksEmptyState from "./LandmarkEmptyState";
import LandmarksLoadFailedState from "./landmark-picker/LandmarksFailedLoadtState";

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

  const nearbyLandmarksLoadFailed = useMerchantRegistrationStore(
    (state) => state.nearbyLandmarksLoadFailed,
  );

  const hasSelectedLocation = selectedLocation !== null;

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
      description="Suggested automatically after you pin your location. You can remove them and add your own."
    >
      {!hasSelectedLocation ? (
        <DisabledSelectionState />
      ) : nearbyLandmarksLoadFailed ? (
        <LandmarksLoadFailedState />
      ) : selectedLandmarks.length === 0 ? (
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

      {hasSelectedLocation && (
        <>
          <CapacityHint
            remaining={remainingLandmarks}
            max={MAX_SELECTED_LANDMARKS}
          />
          <Button
            title="Add Custom Landmark"
            variant="soft"
            icon={
              <MaterialCommunityIcons
                name="map-marker-plus-outline"
                size={20}
                color={theme.extends.colors.brand}
              />
            }
            className="mt-6"
            fontClassName="text-sm"
            onPress={handlePickCustomLandmark}
            disabled={selectedLandmarks.length >= MAX_SELECTED_LANDMARKS}
          />
        </>
      )}

      <Text className="mt-3 text-center text-xs font-medium text-text-secondary">
        Selected: {selectedLandmarks.length} / {MAX_SELECTED_LANDMARKS}
      </Text>
    </RegistrationSection>
  );
}
