import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import AppText from "@/shared/components/AppText";

import { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import RegistrationSection from "../RegistrationSection";
import CapacityHint from "./CapacityHint";
import DisabledSelectionState from "./DisabledSelectionState";
import LandmarkCard from "./LandmarkCard";
import LandmarksEmptyState from "./LandmarkEmptyState";
import LandmarksLoadFailedState from "./landmark-picker/LandmarksFailedLoadtState";

const MAX_SELECTED_LANDMARKS = 5;

/**
 * Displays nearby landmark suggestions for the merchant's confirmed location.
 *
 * Keeps selected landmarks synchronized with the registration form and provides
 * an inline secondary action for adding a custom landmark when capacity allows.
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

  const hasReachedLandmarkLimit =
    selectedLandmarks.length >= MAX_SELECTED_LANDMARKS;

  useEffect(() => {
    setValue("landmarks", selectedLandmarks);
  }, [selectedLandmarks, setValue]);

  function handleRemoveLandmark(id: string) {
    setSelectedLandmarks(
      selectedLandmarks.filter((landmark) => landmark.id !== id),
    );
  }

  function handlePickCustomLandmark() {
    router.push("/(explorer)/merchant-registration/landmarks-picker");
  }

  return (
    <RegistrationSection
      icon="map-marker-radius-outline"
      title="Nearby Landmarks"
      description="Suggested automatically after you pin your location. You can remove them and add your own."
    >
      {/* Landmark selection state */}
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

      {/* Landmark capacity and custom selection */}
      {hasSelectedLocation && (
        <>
          <CapacityHint
            remaining={remainingLandmarks}
            max={MAX_SELECTED_LANDMARKS}
          />

          <View className="mt-4 items-center">
            <Pressable
              onPress={handlePickCustomLandmark}
              disabled={hasReachedLandmarkLimit}
              accessibilityRole="button"
              accessibilityLabel="Add custom landmark"
              accessibilityState={{
                disabled: hasReachedLandmarkLimit,
              }}
              className="min-h-11 cursor-pointer flex-row items-center justify-center rounded-lg px-2 active:opacity-60 disabled:opacity-40"
            >
              <MaterialCommunityIcons
                name="map-marker-plus-outline"
                size={18}
                color={theme.extends.colors.brand}
              />

              <AppText weight="semibold" className="ml-1.5 text-sm text-brand">
                Add custom landmark
              </AppText>

              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={theme.extends.colors.brand}
              />
            </Pressable>
          </View>
        </>
      )}

      {/* Selection count */}
      <AppText
        weight="medium"
        className="mt-3 text-center text-xs text-text-secondary"
      >
        Selected: {selectedLandmarks.length} / {MAX_SELECTED_LANDMARKS}
      </AppText>
    </RegistrationSection>
  );
}
