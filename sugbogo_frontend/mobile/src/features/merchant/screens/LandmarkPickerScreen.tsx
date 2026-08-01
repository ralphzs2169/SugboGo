import { useState, useRef, useEffect } from "react";
import { View, Platform, KeyboardAvoidingView, Keyboard } from "react-native";
import MapView, {
  Circle,
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { getDistance } from "geolib";
import Toast from "react-native-toast-message";

import LandmarkPickerBottomSheet from "../components/registration/landmark/landmark-picker/LandmarkPickerBottomSheet";
import LandmarkPickerHeader from "../components/registration/landmark/landmark-picker/LandmarkPickerHeader";
import MapMarker from "@/shared/components/MapMarker";

type LandmarkPickerScreenProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onConfirm: (landmark: BusinessLandmark) => void;
  onClose: () => void;
};

const LANDMARK_RADIUS_METERS = 1000;

const MAP_LATITUDE_DELTA = 0.025;
const MAP_LONGITUDE_DELTA = 0.025;

const MAP_STYLE = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
];
/**
 * Allows a merchant to manually place one custom landmark
 * near their confirmed business location.
 *
 * Previously selected landmarks are displayed only as reference
 * markers. Google landmark suggestions are not displayed here.
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

  // Prevent marker taps from also triggering the map press handler.
  const markerPressed = useRef(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  /**
   * Places the custom landmark pin where the merchant taps
   * on the map.
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
   * Confirms the manually placed landmark.
   */
  function handleConfirm() {
    if (!customLocation) {
      return;
    }

    const trimmedName = landmarkName.trim();

    if (!trimmedName) {
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

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-background">
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
            latitudeDelta: MAP_LATITUDE_DELTA,
            longitudeDelta: MAP_LONGITUDE_DELTA,
          }}
          customMapStyle={MAP_STYLE}
          onPress={handleMapPress}
        >
          {/* Business location */}
          <Marker
            coordinate={{
              latitude: businessLocation.latitude,
              longitude: businessLocation.longitude,
            }}
            title="Your business"
            onPress={() => {
              markerPressed.current = true;
            }}
          >
            <View collapsable={false}>
              <MapMarker variant="business" />
            </View>
          </Marker>

          {/* 1 km landmark selection area. */}
          <Circle
            center={{
              latitude: businessLocation.latitude,
              longitude: businessLocation.longitude,
            }}
            radius={LANDMARK_RADIUS_METERS}
            strokeWidth={2}
            strokeColor="#1B4D3E"
            fillColor="rgba(27, 77, 62, 0.10)"
          />

          {/* Previously selected landmarks shown only as references. */}
          {selectedLandmarks.map((landmark) => (
            <Marker
              key={landmark.id}
              coordinate={{
                latitude: landmark.latitude,
                longitude: landmark.longitude,
              }}
              title={landmark.name}
              description={landmark.address}
              onPress={() => {
                markerPressed.current = true;
              }}
            >
              <View collapsable={false}>
                <MapMarker
                  variant={landmark.source === "google" ? "google" : "custom"}
                />
              </View>
            </Marker>
          ))}

          {/* Merchant's custom landmark pin. */}
          {customLocation && (
            <Marker
              coordinate={customLocation}
              title="New Landmark"
              onPress={() => {
                markerPressed.current = true;
              }}
            >
              <View collapsable={false}>
                <MapMarker variant="pending" />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Header overlay. */}
        <LandmarkPickerHeader onClose={onClose} />

        {/* Bottom confirmation panel. */}

        <LandmarkPickerBottomSheet
          keyboardHeight={keyboardHeight}
          hasPendingLocation={customLocation !== null}
          landmarkName={landmarkName}
          canSubmit={canSubmit}
          onNameChange={setLandmarkName}
          onConfirm={handleConfirm}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
