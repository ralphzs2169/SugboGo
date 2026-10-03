import { router, type Href } from "expo-router";
import { useEffect } from "react";
import Toast from "react-native-toast-message";

import useMerchantBusinessProfile from "@/features/merchant/hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantLocationChangeRequests } from "@/features/merchant/hooks/location-change/useMerchantLocationChanges";
import LandmarkPickerScreen from "@/features/merchant/screens/LandmarkPickerScreen";
import { useLocationChangeDraftStore } from "@/features/merchant/stores/locationChangeDraftStore";
import { toPickerLocation } from "@/features/merchant/utils/locationChange.utils";
import LoadingScreen from "@/shared/components/LoadingScreen";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

/** Reuses the Registration custom-pin picker for proposal landmarks. */
export default function LocationChangeLandmarkPickerRoute() {
  const { business, isLoading: isProfileLoading } =
    useMerchantBusinessProfile();
  const { pendingRequest, isLoading: isRequestsLoading } =
    useMerchantLocationChangeRequests();
  const location = useLocationChangeDraftStore((state) => state.location);
  const landmarks = useLocationChangeDraftStore((state) => state.landmarks);
  const setLandmarks = useLocationChangeDraftStore(
    (state) => state.setLandmarks,
  );
  const isIneligible =
    !business ||
    business.status !== "active" ||
    Boolean(pendingRequest) ||
    !location;

  useEffect(() => {
    if (!isProfileLoading && !isRequestsLoading && isIneligible) {
      router.replace("/(merchant)/location-change" as Href);
    }
  }, [isIneligible, isProfileLoading, isRequestsLoading]);

  if (isProfileLoading || isRequestsLoading) {
    return (
      <LoadingScreen
        title="Loading Landmarks"
        description="Checking your business..."
      />
    );
  }
  if (isIneligible || !location) {
    return null;
  }

  function handleConfirm(landmark: BusinessLandmark) {
    if (landmarks.length >= 5) {
      Toast.show({
        type: "error",
        text1: "Maximum landmarks reached",
        text2: "You can only add up to five landmarks.",
      });
      return;
    }
    setLandmarks([...landmarks, landmark]);
    Toast.show({ type: "success", text1: "Landmark added" });
    router.back();
  }

  return (
    <LandmarkPickerScreen
      businessLocation={toPickerLocation(location)}
      selectedLandmarks={landmarks}
      onConfirm={handleConfirm}
      onClose={() => router.back()}
    />
  );
}
