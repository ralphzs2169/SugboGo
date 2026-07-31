import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useEffect, useRef, useState } from "react";

import { theme } from "@/constants/theme";
import {
  BusinessLocation,
  BusinessLandmark,
} from "@/shared/types/BusinessLocation.types";

const LANDMARK_RADIUS_METERS = 1000;
const MAX_SELECTED_LANDMARKS = 5;
const MAP_LATITUDE_DELTA = 0.025;
const MAP_LONGITUDE_DELTA = 0.025;

type LandmarkPickerProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  landmarks: BusinessLandmark[];
  isLoading: boolean;
  onConfirm: (landmarks: BusinessLandmark[]) => void;
  onClose: () => void;
};

export default function LandmarkPicker({
  businessLocation,
  selectedLandmarks,
  landmarks,
  isLoading,
  onConfirm,
  onClose,
}: LandmarkPickerProps) {
  const mapRef = useRef<MapView>(null);

  // Keep selections local until the merchant confirms them.
  const [pendingLandmarks, setPendingLandmarks] =
    useState<BusinessLandmark[]>(selectedLandmarks);

  // Reset the temporary selection whenever the picker receives
  // a different set of already-selected landmarks.
  useEffect(() => {
    setPendingLandmarks(selectedLandmarks);
  }, [selectedLandmarks]);

  function isLandmarkSelected(id: string) {
    return pendingLandmarks.some((landmark) => landmark.id === id);
  }

  function handleLandmarkPress(landmark: BusinessLandmark) {
    const isSelected = isLandmarkSelected(landmark.id);

    if (isSelected) {
      setPendingLandmarks((current) =>
        current.filter((selected) => selected.placeId !== landmark.placeId),
      );

      return;
    }

    if (pendingLandmarks.length >= MAX_SELECTED_LANDMARKS) {
      return;
    }

    setPendingLandmarks((current) => [...current, landmark]);
  }

  function handleConfirm() {
    onConfirm(pendingLandmarks);
  }

  return (
    <View className="flex-1 bg-background">
      {/* Map showing the business location and its 1 km landmark area. */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
          latitudeDelta: MAP_LATITUDE_DELTA,
          longitudeDelta: MAP_LONGITUDE_DELTA,
        }}
      >
        {/* The confirmed business location. */}
        <Marker
          coordinate={{
            latitude: businessLocation.latitude,
            longitude: businessLocation.longitude,
          }}
          title="Your business"
          pinColor={theme.extends.colors.brand}
        />

        {/* Visual representation of the 1 km search area. */}
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

        {/* Nearby landmarks returned by the backend. */}
        {landmarks.map((landmark) => (
          <Marker
            key={landmark.placeId}
            coordinate={{
              latitude: landmark.latitude,
              longitude: landmark.longitude,
            }}
            title={landmark.name}
            description={landmark.address}
            pinColor={
              isLandmarkSelected(landmark.id)
                ? theme.extends.colors.brand
                : undefined
            }
            onPress={() => handleLandmarkPress(landmark)}
          />
        ))}
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
                Nearby Landmarks
              </Text>

              <Text className="mt-0.5 text-xs text-text-secondary">
                Select landmarks within 1 km of your business.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Landmark selection panel. */}
      <View className="absolute bottom-0 left-0 right-0">
        <View className="rounded-t-3xl bg-white px-4 pb-8 pt-4 shadow-lg">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-base font-bold text-text-primary">
                Select landmarks
              </Text>

              <Text className="mt-1 text-sm text-text-secondary">
                Selected: {pendingLandmarks.length} / {MAX_SELECTED_LANDMARKS}
              </Text>
            </View>

            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              size={24}
              color="#1B4D3E"
            />
          </View>

          {isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />

              <Text className="mt-2 text-sm text-text-secondary">
                Finding nearby landmarks...
              </Text>
            </View>
          ) : landmarks.length === 0 ? (
            <View className="items-center rounded-xl border border-dashed border-gray-300 px-4 py-5">
              <MaterialCommunityIcons
                name="map-marker-off-outline"
                size={28}
                color="#9CA3AF"
              />

              <Text className="mt-2 text-sm text-text-secondary">
                No nearby landmarks found.
              </Text>
            </View>
          ) : (
            <View className="max-h-48">
              {landmarks.map((landmark) => {
                const selected = isLandmarkSelected(landmark.id);
                const limitReached =
                  pendingLandmarks.length >= MAX_SELECTED_LANDMARKS;

                const disabled = !selected && limitReached;

                return (
                  <Pressable
                    key={landmark.placeId}
                    onPress={() => handleLandmarkPress(landmark)}
                    disabled={disabled}
                    className="mb-2 flex-row items-center rounded-xl border border-gray-200 px-3 py-3"
                    style={{
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={
                        selected ? "checkbox-marked" : "checkbox-blank-outline"
                      }
                      size={23}
                      color={selected ? theme.extends.colors.brand : "#9CA3AF"}
                    />

                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold text-text-primary">
                        {landmark.name}
                      </Text>

                      <Text
                        numberOfLines={1}
                        className="mt-0.5 text-xs text-text-secondary"
                      >
                        {landmark.address}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={handleConfirm}
            className="mt-3 items-center rounded-xl bg-[#1B4D3E] px-4 py-3.5"
          >
            <Text className="text-sm font-bold text-white">
              Confirm Landmarks
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
