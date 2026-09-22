import { router } from "expo-router";
import { getDistance } from "geolib";
import { useEffect, useRef, useState } from "react";
import type { MapPressEvent } from "react-native-maps";
import { Keyboard, Platform, View } from "react-native";
import Toast from "react-native-toast-message";

import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

import LandmarkPickerBottomSheet from "../components/registration/landmark/landmark-picker/LandmarkPickerBottomSheet";
import LandmarkPickerHeader from "../components/registration/landmark/landmark-picker/LandmarkPickerHeader";
import LandmarkPickerMap from "../components/registration/landmark/landmark-picker/LandmarkPickerMap";
import { LANDMARK_RADIUS_METERS } from "../constants/registration/map.constants";
import type { LandmarkNameErrors } from "../validation/customLandmark";
import { validateLandmarkName } from "../validation/customLandmark";
import { isDuplicateLandmarkName } from "../validation/duplicateLandmark";

type LandmarkPickerScreenProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onConfirm: (landmark: BusinessLandmark) => void;
  onClose: () => void;
};

function formatRadius(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${distanceMeters / 1000} km`;
  }

  return `${distanceMeters} m`;
}

/**
 * Allows a merchant to create a custom landmark near their business.
 *
 * Keeps the map visually primary while validating the allowed landmark radius,
 * landmark name, duplicate names, and maximum landmark capacity locally.
 */
export default function LandmarkPickerScreen({
  businessLocation,
  selectedLandmarks,
  onConfirm,
  onClose,
}: LandmarkPickerScreenProps) {
  const [customLocation, setCustomLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [landmarkName, setLandmarkName] = useState("");
  const [errors, setErrors] = useState<LandmarkNameErrors>({});

  const markerPressed = useRef(false);

  const landmarkRadiusLabel = formatRadius(LANDMARK_RADIUS_METERS);

  function handleNameChange(text: string) {
    setLandmarkName(text);

    if (errors.name) {
      setErrors({});
    }
  }

  function handleMapPress(event: MapPressEvent) {
    if (markerPressed.current) {
      markerPressed.current = false;
      return;
    }

    const coordinate = event.nativeEvent.coordinate;

    const distance = getDistance(
      {
        latitude: businessLocation.latitude,
        longitude: businessLocation.longitude,
      },
      {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      },
    );

    if (distance > LANDMARK_RADIUS_METERS) {
      Toast.show({
        type: "error",
        text1: "Outside landmark area",
        text2: `Choose a location within ${landmarkRadiusLabel} of your business.`,
      });

      return;
    }

    setCustomLocation(coordinate);
  }

  function handleConfirm() {
    if (!customLocation) {
      return;
    }

    const validationErrors = validateLandmarkName(landmarkName);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const trimmedName = landmarkName.trim().replace(/\s+/g, " ");

    if (isDuplicateLandmarkName(trimmedName, selectedLandmarks)) {
      setErrors({
        name: "A landmark with this name already exists.",
      });

      return;
    }

    if (selectedLandmarks.length >= 5) {
      Toast.show({
        type: "error",
        text1: "Maximum landmarks reached",
        text2: "You can only add up to 5 landmarks.",
      });

      return;
    }

    const customLandmark: BusinessLandmark = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      address: "",
      latitude: customLocation.latitude,
      longitude: customLocation.longitude,
      source: "custom",
    };

    onConfirm(customLandmark);

    setCustomLocation(null);
    setLandmarkName("");
  }

  const canSubmit = customLocation !== null && landmarkName.trim().length > 0;

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });

    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View className="flex-1 bg-background">
      {/* Map selection surface */}
      <LandmarkPickerMap
        businessLocation={businessLocation}
        selectedLandmarks={selectedLandmarks}
        customLocation={customLocation}
        landmarkName={landmarkName}
        onMapPress={handleMapPress}
        onExistingMarkerPress={() => {
          markerPressed.current = true;
        }}
      />

      {/* Navigation context */}
      <LandmarkPickerHeader onClose={onClose} />

      {/* Landmark guidance and confirmation */}
      <LandmarkPickerBottomSheet
        keyboardHeight={keyboardHeight}
        hasPendingLocation={customLocation !== null}
        landmarkName={landmarkName}
        canSubmit={canSubmit}
        landmarkRadiusLabel={landmarkRadiusLabel}
        onNameChange={handleNameChange}
        onConfirm={handleConfirm}
        landmarkNameError={errors.name}
      />
    </View>
  );
}
