import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import Toast from "react-native-toast-message";

import useMerchantBusinessProfile from "@/features/merchant/hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantLocationChangeRequests } from "@/features/merchant/hooks/location-change/useMerchantLocationChanges";
import useNearbyLandmarks from "@/features/merchant/hooks/location-selection/useNearbyLandmarks";
import LocationPickerScreen from "@/features/merchant/screens/LocationPickerScreen";
import { useLocationChangeDraftStore } from "@/features/merchant/stores/locationChangeDraftStore";
import {
  selectedLocationProposal,
  toPickerLocation,
} from "@/features/merchant/utils/locationChange.utils";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { BusinessLocation } from "@/shared/types/BusinessLocation.types";

/** Reuses the Registration map picker while writing only to the request draft. */
export default function LocationChangePickerRoute() {
  const { business, isLoading: isProfileLoading } =
    useMerchantBusinessProfile();
  const { pendingRequest, isLoading: isRequestsLoading } =
    useMerchantLocationChangeRequests();
  const location = useLocationChangeDraftStore((state) => state.location);
  const landmarks = useLocationChangeDraftStore((state) => state.landmarks);
  const setLocation = useLocationChangeDraftStore((state) => state.setLocation);
  const setLandmarks = useLocationChangeDraftStore(
    (state) => state.setLandmarks,
  );
  const setNearbyFailure = useLocationChangeDraftStore(
    (state) => state.setNearbyLandmarksLoadFailed,
  );
  const { searchNearbyLandmarks } = useNearbyLandmarks();
  const [pendingSelection, setPendingSelection] =
    useState<BusinessLocation | null>(null);
  const [isRefreshingLandmarks, setIsRefreshingLandmarks] = useState(false);
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
        title="Loading Location"
        description="Checking your business..."
      />
    );
  }
  if (isIneligible || !location) {
    return null;
  }

  async function confirmLocation(selected: BusinessLocation) {
    if (!location || isRefreshingLandmarks) {
      return;
    }
    setIsRefreshingLandmarks(true);
    setPendingSelection(null);
    const proposed = selectedLocationProposal(selected, location);

    // The draft store clears old proposed landmarks before nearby lookup.
    setLocation(proposed);
    try {
      const result = await searchNearbyLandmarks(
        proposed.latitude,
        proposed.longitude,
      );
      setLandmarks(result.landmarks.slice(0, 5));
      setNearbyFailure(!result.success);
      Toast.show({
        type: "success",
        text1: "Location confirmed successfully.",
      });
      router.back();
    } finally {
      setIsRefreshingLandmarks(false);
    }
  }

  function handleConfirm(selected: BusinessLocation) {
    if (!location || isRefreshingLandmarks) {
      return;
    }
    const moved =
      selected.latitude !== location.latitude ||
      selected.longitude !== location.longitude;
    if (!moved) {
      setLocation(selectedLocationProposal(selected, location));
      router.back();
      return;
    }
    if (landmarks.length > 0) {
      setPendingSelection(selected);
      return;
    }
    void confirmLocation(selected);
  }

  return (
    <>
      <LocationPickerScreen
        initialLocation={toPickerLocation(location)}
        onConfirm={handleConfirm}
        onClose={() => router.back()}
        isConfirming={isRefreshingLandmarks}
      />
      <ConfirmModal
        visible={pendingSelection !== null}
        title="Update location details?"
        message="Changing your location will reset selected landmarks and load nearby places for the new pin. Your live location remains unchanged."
        confirmText="Continue"
        cancelText="Keep Current"
        onCancel={() => {
          if (!isRefreshingLandmarks) {
            setPendingSelection(null);
          }
        }}
        onConfirm={() => {
          if (pendingSelection) {
            void confirmLocation(pendingSelection);
          }
        }}
        isLoading={isRefreshingLandmarks}
        loadingText="Updating location details..."
      />
    </>
  );
}
