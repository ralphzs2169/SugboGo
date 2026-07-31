import { router } from "expo-router";

import { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import BusinessLocationPickerScreen from "@/features/merchant/screens/BusinessLocationPickerScreen";
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

  function handleConfirm(location: BusinessLocation) {
    setTimeout(() => {
      Toast.show({
        type: "success",
        text1: "Location confirmed successfully.",
      });
    }, 500);

    setSelectedLocation(location);
    router.back();
  }

  function handleClose() {
    router.back();
  }

  return (
    <BusinessLocationPickerScreen
      initialLocation={selectedLocation}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  );
}
