import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";

import useUserLocation from "@/shared/hooks/useUserLocation";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import JourneyOriginPickerMap from "../components/getting-there/JourneyOriginPickerMap";
import JourneyOriginSearchSheet from "../components/getting-there/JourneyOriginSearchSheet";
import useJourneyOriginPicker from "../hooks/useJourneyOriginPicker";
import JourneyOriginConfirmationFooter from "../components/getting-there/origin-picker/JourneyOriginConfirmationFooter";
import JourneyOriginMapHeader from "../components/getting-there/origin-picker/JourneyOriginMapHeader";

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
      picker.useCurrentLocation(userLocation.latitude, userLocation.longitude);
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
      <JourneyOriginMapHeader
        onBack={() => router.back()}
        onSearch={() => presentBottomSheet(searchSheetRef)}
      />

      {/* Starting-point confirmation */}
      <JourneyOriginConfirmationFooter
        selectedLabel={picker.draftOrigin?.label}
        isResolvingLabel={picker.isResolvingLabel}
        isRefreshingLocation={userLocation.isRefreshingLocation}
        canConfirm={Boolean(picker.draftOrigin) && !picker.isResolvingLabel}
        onUseCurrentLocation={handleUseCurrentLocation}
        onConfirm={handleConfirm}
      />

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
