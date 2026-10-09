import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import MapView from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import LandmarkMap from "../../components/registration/landmark/LanmarkMap";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

/** Displays the approved business pin and landmarks on the shared read-only map. */
export default function MerchantApprovedLocationMapScreen() {
  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();
  const mapRef = useRef<MapView>(null);

  useQueryErrorNotification({
    error,
    toastId: "merchant-approved-location-map-error",
    title: "Unable to load business location",
    fallbackMessage: "Please try again.",
  });

  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading business location"
        description="Preparing the approved map and landmarks."
      />
    );
  }

  if (!business) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorState
          title="Unable to load business location"
          description="Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={refetch}
          secondaryActionTitle="Go back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const location = business.location;
  const landmarks: BusinessLandmark[] = location.landmarks.map((landmark) => ({
    id: String(landmark.id),
    name: landmark.name,
    address: landmark.address,
    latitude: landmark.latitude,
    longitude: landmark.longitude,
    source: landmark.source,
  }));

  function fitMarkers() {
    if (!mapRef.current) return;
    const coordinates = [
      { latitude: location.latitude, longitude: location.longitude },
      ...landmarks.map((landmark) => ({
        latitude: landmark.latitude,
        longitude: landmark.longitude,
      })),
    ];
    if (coordinates.length > 1) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 110, right: 56, bottom: 120, left: 56 },
        animated: false,
      });
    }
  }

  function recenter() {
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.014,
      longitudeDelta: 0.014,
    });
  }

  return (
    <View className="flex-1 bg-background">
      {/* Approved map and existing marker callouts */}
      <LandmarkMap
        businessLocation={location}
        selectedLandmarks={landmarks}
        mapRef={mapRef}
        onMapReady={fitMarkers}
      />

      {/* Safe-area map navigation and recenter control */}
      <SafeAreaView
        edges={["top", "left", "right"]}
        pointerEvents="box-none"
        className="absolute inset-x-0 top-0 flex-row items-center justify-between px-5"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>
        <Pressable
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Recenter on business"
          className="h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface"
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>
      </SafeAreaView>

      {/* Map context remains visible while panning */}
      <SafeAreaView
        edges={["bottom"]}
        pointerEvents="box-none"
        className="absolute inset-x-0 bottom-0 px-5 pb-4"
      >
        <View className="rounded-xl border border-border-primary bg-surface px-4 py-3">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {business.business_name}
          </AppText>
          <AppText className="mt-1 text-xs text-text-secondary">
            Approved business location · {landmarks.length} landmark
            {landmarks.length === 1 ? "" : "s"}
          </AppText>
        </View>
      </SafeAreaView>
    </View>
  );
}
