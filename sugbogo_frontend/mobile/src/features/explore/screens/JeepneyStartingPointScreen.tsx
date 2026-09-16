import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useRef } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import useUserLocation from "@/shared/hooks/useUserLocation";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import JourneyOriginPickerMap from "../components/getting-there/JourneyOriginPickerMap";
import JourneyOriginSearchSheet from "../components/getting-there/JourneyOriginSearchSheet";
import useJourneyOriginPicker from "../hooks/useJourneyOriginPicker";

type Props = {
  businessId: number;
};

/**
 * Lets an Explorer draft and confirm a starting point on a full-screen map.
 *
 * Search, map taps, marker dragging, and device location remain local until
 * confirmation, so normal Back navigation safely discards experiments.
 */
export default function JeepneyStartingPointScreen({ businessId }: Props) {
  const insets = useSafeAreaInsets();
  const searchSheetRef = useRef<BottomSheetModal>(null);
  const userLocation = useUserLocation();
  const picker = useJourneyOriginPicker(businessId, {
    status: userLocation.status,
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
  });

  const handleUseCurrentLocation = async () => {
    if (
      userLocation.status === "available" &&
      userLocation.latitude !== null &&
      userLocation.longitude !== null
    ) {
      picker.useCurrentLocation(
        userLocation.latitude,
        userLocation.longitude,
      );
      return;
    }

    const result = await userLocation.refreshLocation();

    if (result.status === "available") {
      picker.useCurrentLocation(
        result.location.coords.latitude,
        result.location.coords.longitude,
      );
    }
  };

  const handleConfirm = () => {
    if (picker.confirmDraft()) {
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Map selection surface */}
      <JourneyOriginPickerMap
        origin={picker.draftOrigin}
        onLocationSelect={(latitude, longitude) => {
          void picker.selectMapPoint(latitude, longitude);
        }}
      />

      {/* Navigation and place search */}
      <SafeAreaView
        edges={["top"]}
        pointerEvents="box-none"
        className="absolute left-0 right-0 top-0 px-screen-x pt-3"
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back without changing starting point"
            className="h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface shadow-sm active:opacity-70"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={23}
              color={theme.extends.colors.text.primary}
            />
          </Pressable>

          <Pressable
            onPress={() => presentBottomSheet(searchSheetRef)}
            accessibilityRole="button"
            accessibilityLabel="Search place or landmark"
            className="min-h-12 flex-1 cursor-pointer flex-row items-center rounded-2xl border border-border-primary bg-surface px-4 shadow-sm active:opacity-80"
          >
            <MaterialCommunityIcons
              name="magnify"
              size={21}
              color={theme.extends.colors.text.secondary}
            />
            <AppText className="ml-3 flex-1 text-sm text-text-secondary">
              Search place or landmark
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Draft details and confirmation */}
      <View
        className="absolute bottom-0 left-0 right-0 px-screen-x"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="rounded-2xl border border-border-primary bg-surface p-4 shadow-lg">
          <View className="flex-row items-start">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <MaterialCommunityIcons
                name="map-marker"
                size={22}
                color={theme.extends.colors.brand}
              />
            </View>
            <View className="ml-3 flex-1">
              <AppText weight="bold" className="text-sm text-text-primary">
                Selected starting point
              </AppText>
              <View className="mt-1 min-h-5 flex-row items-center">
                {picker.isResolvingLabel ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={theme.extends.colors.brand}
                    />
                    <AppText className="ml-2 text-sm text-text-secondary">
                      Finding this location…
                    </AppText>
                  </>
                ) : (
                  <AppText
                    className="flex-1 text-sm text-text-secondary"
                    numberOfLines={2}
                  >
                    {picker.draftOrigin?.label ??
                      "Tap the map or search for a place."}
                  </AppText>
                )}
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => void handleUseCurrentLocation()}
            disabled={userLocation.isRefreshingLocation}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            accessibilityState={{
              disabled: userLocation.isRefreshingLocation,
              busy: userLocation.isRefreshingLocation,
            }}
            className="mt-3 min-h-11 cursor-pointer flex-row items-center justify-center rounded-xl active:bg-surface-secondary disabled:opacity-60"
          >
            {userLocation.isRefreshingLocation ? (
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.brand}
              />
            ) : (
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={19}
                color={theme.extends.colors.brand}
              />
            )}
            <AppText weight="bold" className="ml-2 text-sm text-brand">
              Use current location
            </AppText>
          </Pressable>

          <Button
            title="Confirm starting point"
            onPress={handleConfirm}
            disabled={!picker.draftOrigin || picker.isResolvingLabel}
            rounded="full"
            className="mt-3 py-3.5"
          />
        </View>
      </View>

      {/* Full-height place search */}
      <JourneyOriginSearchSheet
        sheetRef={searchSheetRef}
        onPlaceSelect={(latitude, longitude, label) => {
          picker.selectPlace(latitude, longitude, label);
        }}
      />
    </View>
  );
}
