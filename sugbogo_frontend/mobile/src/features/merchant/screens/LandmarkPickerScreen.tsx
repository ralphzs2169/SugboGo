import { useState, useRef, useEffect } from "react";
import { View, Platform, KeyboardAvoidingView, Keyboard } from "react-native";
import { MapPressEvent } from "react-native-maps";
import { getDistance } from "geolib";
import Toast from "react-native-toast-message";
import { LANDMARK_RADIUS_METERS } from "../constants/map.constants";
import { validateLandmarkName } from "../validation/customLandmark";
import LandmarkPickerMap from "../components/registration/landmark/landmark-picker/LandmarkPickerMap";
import LandmarkPickerBottomSheet from "../components/registration/landmark/landmark-picker/LandmarkPickerBottomSheet";
import LandmarkPickerHeader from "../components/registration/landmark/landmark-picker/LandmarkPickerHeader";
import { LandmarkNameErrors } from "../validation/customLandmark";
import { isDuplicateLandmarkName } from "../validation/duplicateLandmark";
import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

type LandmarkPickerScreenProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onConfirm: (landmark: BusinessLandmark) => void;
  onClose: () => void;
};

/**
 * Allows a merchant to manually add a custom landmark
 * near their confirmed business location.
 *
 * Merchants place a marker by tapping the map, provide
 * a landmark name, and confirm the selection.
 *
 * Existing landmarks are displayed as reference markers
 * to help avoid duplicate locations.
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

  /**
   * Updates the landmark name while clearing any previous
   * validation error as soon as the user edits the field.
   */
  function handleNameChange(text: string) {
    setLandmarkName(text);

    if (errors.name) {
      setErrors({});
    }
  }

  // Prevent marker taps from also triggering the map press handler.
  const markerPressed = useRef(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  /**
   * Places a custom landmark marker where the merchant taps.
   *
   * Taps outside the allowed landmark radius are rejected.
   * Marker taps are ignored to prevent accidental placement.
   */
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
        text2: "Please choose a location within 1 km of your business.",
      });

      return;
    }

    setCustomLocation(coordinate);
  }

  /**
   * Validates the custom landmark and submits it.
   *
   * Validation includes:
   * - landmark name rules
   * - duplicate landmark names
   * - maximum landmark limit
   */
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
        text2: "You can only add up to five landmarks.",
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

  /**
   * Tracks the keyboard height so the bottom sheet
   * remains visible while entering the landmark name.
   */
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Enable submission only after a marker has been placed
  // and the merchant has entered some text.
  const canSubmit = customLocation !== null && landmarkName.trim().length > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-background">
        {/* Interactive Map */}
        <LandmarkPickerMap
          businessLocation={businessLocation}
          selectedLandmarks={selectedLandmarks}
          customLocation={customLocation}
          onMapPress={handleMapPress}
          onExistingMarkerPress={() => {
            markerPressed.current = true;
          }}
        />

        {/* Header overlay. */}
        <LandmarkPickerHeader onClose={onClose} />

        {/* Bottom confirmation panel. */}

        <LandmarkPickerBottomSheet
          keyboardHeight={keyboardHeight}
          hasPendingLocation={customLocation !== null}
          landmarkName={landmarkName}
          canSubmit={canSubmit}
          onNameChange={handleNameChange}
          onConfirm={handleConfirm}

          landmarkNameError={errors.name}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
