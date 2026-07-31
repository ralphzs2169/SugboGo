import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, {
  Circle,
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import { theme } from "@/constants/theme";
import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { getDistance } from "geolib";
import Toast from "react-native-toast-message";
import { SafeAreaView } from "react-native-safe-area-context";
import FormInput from "@/shared/components/form/FormInput";

const LANDMARK_RADIUS_METERS = 1000;

const MAP_LATITUDE_DELTA = 0.025;
const MAP_LONGITUDE_DELTA = 0.025;

const BUSINESS_MARKER_COLOR = theme.extends.colors.brand;
const GOOGLE_LANDMARK_MARKER_COLOR = "#4285F4";
const CUSTOM_LANDMARK_MARKER_COLOR = "#F27F0D";
const PENDING_LANDMARK_MARKER_COLOR = "#EF4444";

type LandmarkPickerScreenProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onConfirm: (landmark: BusinessLandmark) => void;
  onClose: () => void;
};

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

  /**
   * Places the custom landmark pin where the merchant taps
   * on the map.
   */
  function handleMapPress(event: MapPressEvent) {
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

  return (
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
        onPress={handleMapPress}
      >
        {/* Confirmed business location. */}
        <Marker
          coordinate={{
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
          }}
          title="Your business"
          pinColor={theme.extends.colors.brand}
        />

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
            pinColor={
              landmark.source === "google"
                ? GOOGLE_LANDMARK_MARKER_COLOR
                : CUSTOM_LANDMARK_MARKER_COLOR
            }
          />
        ))}

        {/* Merchant's custom landmark pin. */}
        {customLocation && (
          <Marker
            coordinate={customLocation}
            title="New Landmark"
            pinColor={PENDING_LANDMARK_MARKER_COLOR}
          />
        )}
      </MapView>

      {/* Header overlay. */}
      <View className="absolute left-4 right-4 top-12">
        <View className="rounded-2xl bg-white px-4 py-3 shadow-lg">
          <View className="flex-row items-center">
            <Pressable
              onPress={onClose}
              className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={21}
                color="#1B4D3E"
              />
            </Pressable>

            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">
                Pick Your Landmark
              </Text>

              <Text className="mt-0.5 text-xs text-text-secondary">
                Tap anywhere within 1 km to place your landmark.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom confirmation panel. */}

      <View className="absolute bottom-0 left-0 right-0">
        <SafeAreaView edges={["bottom"]}>
          <View className="rounded-t-3xl bg-white px-4 pt-4 shadow-lg">
            {!customLocation ? (
              <>
                <View className="mb-3 flex-row items-center">
                  <MaterialCommunityIcons
                    name="map-marker-plus-outline"
                    size={24}
                    color="#1B4D3E"
                  />

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-bold text-text-primary">
                      Choose a landmark location
                    </Text>

                    <Text className="mt-1 text-sm text-text-secondary">
                      Tap anywhere inside the 1 km radius to place your
                      landmark.
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View className="mb-4 flex-row items-center">
                  <MaterialCommunityIcons
                    name="map-marker-check-outline"
                    size={24}
                    color={theme.extends.colors.brand}
                  />

                  <View className="ml-3 flex-1">
                    <Text className="text-base font-bold text-text-primary">
                      Name your Landmark
                    </Text>

                    <Text className="mt-1 text-sm text-text-secondary">
                      Give this landmark a clear name to help explorers find
                      your business.
                    </Text>
                  </View>
                </View>

                <FormInput
                  label="Landmark Name"
                  placeholder="e.g. Front Gate"
                  value={landmarkName}
                  onChangeText={setLandmarkName}
                  maxLength={50}
                />

                <View className="mt-5 flex-row">
                  <Pressable
                    onPress={handleConfirm}
                    disabled={!canSubmit}
                    className="ml-2 flex-1 items-center rounded-xl bg-brand py-3"
                    style={{
                      opacity: canSubmit ? 1 : 0.45,
                    }}
                  >
                    <Text className="font-semibold text-white">
                      Add Landmark
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
