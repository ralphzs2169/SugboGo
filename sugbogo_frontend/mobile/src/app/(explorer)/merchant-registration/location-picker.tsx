import useNearbyLandmarks from "@/features/merchant/hooks/registration/useNearbyLandmarks";
import LocationPickerScreen from "@/features/merchant/screens/LocationPickerScreen";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Toast from "react-native-toast-message";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";

/**
 * Route wrapper for the full-screen business location picker.
 *
 * After a location is confirmed, the selected coordinates and the
 * initial reverse-geocoded address are stored in Zustand before
 * returning to the registration screen.
 *
 * The editable address is stored separately from the selected
 * location so manual address corrections (for example, an
 * undetected barangay or edited street name) are preserved when
 * navigating away from Step 2.
 */
export default function BusinessLocationPickerPage() {
  const navigation = useNavigation();
  const session = useRef({
    ownerId: useAuthStore.getState().user?.id,
    generation: getAuthSessionGeneration(),
  }).current;
  const active = useRef(false);
  const confirmation = useRef<object | null>(null);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      setIsRefreshingLandmarks(false);

      const invalidate = () => {
        active.current = false;
        confirmation.current = null;
      };
      const unsubscribe = navigation.addListener("beforeRemove", invalidate);

      return () => {
        invalidate();
        unsubscribe();
      };
    }, [navigation]),
  );

  function isCurrentSession() {
    const auth = useAuthStore.getState();
    return (
      active.current &&
      auth.isAuthenticated &&
      !auth.isLoading &&
      session.ownerId !== undefined &&
      auth.user?.id === session.ownerId &&
      isAuthSessionCurrent(session.generation)
    );
  }

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

  const setAddressLoadFailures = useMerchantRegistrationStore(
    (state) => state.setAddressLoadFailures,
  );

  const setSelectedAddress = useMerchantRegistrationStore(
    (state) => state.setSelectedAddress,
  );

  const { searchNearbyLandmarks } = useNearbyLandmarks();
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  const [isRefreshingLandmarks, setIsRefreshingLandmarks] = useState(false);

  /**
   * Confirms the selected business location.
   *
   * Nearby landmarks are fetched for the new coordinates and the
   * registration state is updated before returning to Step 2.
   *
   * The detected address is also copied into the editable address
   * store. This becomes the initial value shown in the registration
   * form and may later diverge from the selected location if the
   * merchant manually edits the address.
   */
  async function confirmLocation(
    location: BusinessLocation,
    addressLoadFailed: boolean,
  ) {
    if (!isCurrentSession() || confirmation.current !== null) {
      return;
    }

    const operation = {};
    confirmation.current = operation;
    setIsRefreshingLandmarks(true);

    const isCurrentOperation = () => (
      confirmation.current === operation && isCurrentSession()
    );

    try {
      const result = await searchNearbyLandmarks(
        location.latitude,
        location.longitude,
      );

      if (!isCurrentOperation()) {
        return;
      }

      setSelectedLocation(location);

      // Initialize the editable address from the reverse-geocoded result.
      //
      // The registration form edits `selectedAddress`, not
      // `selectedLocation`, so later manual corrections (such as
      // entering a missing barangay or changing the street name)
      // are preserved when revisiting Step 2.
      setSelectedAddress({
        province: location.province,
        city: location.city,
        barangay: location.barangay,
        streetAddress: location.streetAddress,
        unit: "",
      });

      setAddressLoadFailures({
        province: !location.province,
        city: !location.city,
        barangay: !location.barangay,
        streetAddress: !location.streetAddress,
      });

      setSelectedLandmarks(result.landmarks);
      setNearbyLandmarksLoadFailed(!result.success);
      setAddressLoadFailed(addressLoadFailed);

      setShowRefreshModal(false);
      setPendingLocation(null);

      Toast.show({
        type: "success",
        text1: "Location confirmed successfully.",
      });

      handleClose();
    } catch (error) {
      if (!isCurrentOperation()) {
        return;
      }

      console.error(error);

      Toast.show({
        type: "error",
        text1: "Unable to load nearby landmarks.",
      });
    } finally {
      if (confirmation.current === operation) {
        confirmation.current = null;
        setIsRefreshingLandmarks(false);
      }
    }
  }

  function handleClose() {
    if (!active.current) {
      return;
    }

    active.current = false;
    confirmation.current = null;
    router.back();
  }

  function handleConfirm(
    location: BusinessLocation,
    addressLoadFailed: boolean,
  ) {
    if (!isCurrentSession() || confirmation.current !== null) {
      return;
    }

    const locationChanged =
      !selectedLocation ||
      selectedLocation.latitude !== location.latitude ||
      selectedLocation.longitude !== location.longitude;

    if (!locationChanged) {
      handleClose();
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
        // icon="map-marker-radius"
        visible={showRefreshModal}
        title="Update location details?"
        message="Changing your location will update your address and nearby landmarks. Do you want to continue?"
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
        loadingText="Updating location details..."
      />
    </>
  );
}
