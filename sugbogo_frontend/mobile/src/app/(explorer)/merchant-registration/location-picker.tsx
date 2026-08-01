import { router } from "expo-router";
import { useState } from "react";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import useNearbyLandmarks from "@/features/merchant/hooks/registration/useNearbyLandmarks";
import LocationPickerScreen from "@/features/merchant/screens/LocationPickerScreen";
import Toast from "react-native-toast-message";

/**
 * Route wrapper for the full-screen business location picker.
 *
 * Uses the existing registration location from Zustand and stores
 * the confirmed location before returning to registration.
 */
export default function BusinessLocationPickerPage() {
  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const setSelectedLocation = useMerchantRegistrationStore(
    (state) => state.setSelectedLocation,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  const [pendingLocation, setPendingLocation] = useState<{
    location: BusinessLocation;
    addressLoadFailed: boolean;
  } | null>(null);

  const setSelectedLandmarks = useMerchantRegistrationStore(
    (state) => state.setSelectedLandmarks,
  );

  const setNearbyLandmarksLoadFailed = useMerchantRegistrationStore(
    (state) => state.setNearbyLandmarksLoadFailed,
  );

  const setAddressLoadFailed = useMerchantRegistrationStore(
    (state) => state.setAddressLoadFailed,
  );

  const { searchNearbyLandmarks } = useNearbyLandmarks();
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  const [isRefreshingLandmarks, setIsRefreshingLandmarks] = useState(false);

  async function confirmLocation(
    location: BusinessLocation,
    addressLoadFailed: boolean,
  ) {
    setIsRefreshingLandmarks(true);

    try {
      const result = await searchNearbyLandmarks(
        location.latitude,
        location.longitude,
      );

      setSelectedLocation(location);
      setSelectedLandmarks(result.landmarks);
      setNearbyLandmarksLoadFailed(!result.success);
      setAddressLoadFailed(addressLoadFailed);

      setShowRefreshModal(false);
      setPendingLocation(null);

      Toast.show({
        type: "success",
        text1: "Location confirmed successfully.",
      });

      router.back();
    } catch (error) {
      console.error(error);

      Toast.show({
        type: "error",
        text1: "Unable to load nearby landmarks.",
      });
    } finally {
      setIsRefreshingLandmarks(false);
    }
  }

  function handleClose() {
    router.back();
  }

  function handleConfirm(
    location: BusinessLocation,
    addressLoadFailed: boolean,
  ) {
    const locationChanged =
      !selectedLocation ||
      selectedLocation.latitude !== location.latitude ||
      selectedLocation.longitude !== location.longitude;

    if (!locationChanged) {
      router.back();
      return;
    }

    if (selectedLandmarks.length > 0) {
      setPendingLocation({
        location,
        addressLoadFailed,
      });
      setShowRefreshModal(true);
      return;
    }

    confirmLocation(location, addressLoadFailed);
  }

  return (
    <>
      <LocationPickerScreen
        initialLocation={selectedLocation}
        onConfirm={handleConfirm}
        onClose={handleClose}
        isConfirming={isRefreshingLandmarks}
      />

      <ConfirmModal
        icon="map-marker-radius"
        visible={showRefreshModal}
        title="Refresh nearby landmarks?"
        message="Changing your business location will replace your current landmarks with the nearest landmarks for the new location."
        confirmText="Continue"
        cancelText="Keep Current"
        onCancel={() => {
          if (isRefreshingLandmarks) {
            return;
          }

          setPendingLocation(null);
          setShowRefreshModal(false);
        }}
        onConfirm={() => {
          if (!pendingLocation) {
            return;
          }

          confirmLocation(
            pendingLocation.location,
            pendingLocation.addressLoadFailed,
          );
        }}
        isLoading={isRefreshingLandmarks}
        loadingText="Loading nearby landmarks..."
      />
    </>
  );
}
