import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";

import { MAX_SELECTED_LANDMARKS } from "@/features/merchant/constants/registration/map.constants";
import LandmarkPickerScreen from "@/features/merchant/screens/LandmarkPickerScreen";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

/**
 * Route responsible for adding a custom landmark.
 *
 * It ensures a business location has already been selected,
 * then saves the newly created custom landmark to the
 * registration store.
 */
export default function BusinessLandmarkPickerPage() {
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const isArrivalPicker = purpose === "arrival";
  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  // Prevent access to the landmark picker until a business
  // location has been selected.
  if (!selectedLocation) {
    router.back();
    return null;
  }

  /**
   * Adds the newly created custom landmark to the
   * registration store.
   */
  function handleConfirm(customLandmark: BusinessLandmark) {
    const current = useMerchantRegistrationStore.getState();
    if (current.selectedLocation !== selectedLocation) return;

    if (current.selectedLandmarks.length >= MAX_SELECTED_LANDMARKS) {
      Toast.show({
        type: "error",
        text1: "Maximum landmarks reached",
        text2: `You can only add up to ${MAX_SELECTED_LANDMARKS} landmarks.`,
      });

      return;
    }

    current.setSelectedLandmarks([...current.selectedLandmarks, customLandmark]);
    if (isArrivalPicker) {
      current.setArrivalLandmark(customLandmark.id);
    }

    Toast.show({
      type: "success",
      text1: isArrivalPicker ? "Arrival landmark selected" : "Landmark added",
    });

    router.back();
  }

  return (
    <LandmarkPickerScreen
      businessLocation={selectedLocation}
      selectedLandmarks={selectedLandmarks}
      onConfirm={handleConfirm}
      onClose={() => router.back()}
    />
  );
}
