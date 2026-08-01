import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useFormContext } from "react-hook-form";
import { router } from "expo-router";
import { useEffect } from "react";
import { theme } from "@/constants/theme";
import LandmarkCard from "./LandmarkCard";
import LandmarksEmptyState from "./LandmarkEmptyState";
import LandmarksLoadFailedState from "./landmark-picker/LandmarksFailedLoadtState";
import Button from "@/shared/components/Button";
import CapacityHint from "./CapacityHint";
import DisabledSelectionState from "./DisabledSelectionState";
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
      description="Nearby landmarks are automatically suggested after you pin your business location. Review them and add custom landmarks if needed."
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
