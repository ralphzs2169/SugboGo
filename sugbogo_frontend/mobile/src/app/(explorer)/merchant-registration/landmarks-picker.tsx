import { useEffect } from "react";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import LandmarkPickerScreen from "@/features/merchant/screens/LandmarkPickerScreen";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import useNearbyLandmarks from "@/features/merchant/hooks/registration/useNearbyLandmarks";
import { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

/**
 * Route responsible for adding a custom landmark.
 *
 * It ensures a business location has already been selected,
 * preloads nearby Google landmarks, and saves the newly
 * created custom landmark to the registration store.
 */
export default function BusinessLandmarkPickerPage() {
  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  const setSelectedLandmarks = useMerchantRegistrationStore(
    (state) => state.setSelectedLandmarks,
  );

  const { searchNearbyLandmarks } = useNearbyLandmarks();

  /**
   * Preloads nearby Google landmarks once a business
   * location has been selected.
   */
  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    searchNearbyLandmarks(
      selectedLocation.latitude,
      selectedLocation.longitude,
    );
  }, [selectedLocation, searchNearbyLandmarks]);

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
    if (selectedLandmarks.length >= 5) {
      Toast.show({
        type: "error",
        text1: "Maximum landmarks reached",
        text2: "You can only add up to five landmarks.",
      });

      return;
    }

    setSelectedLandmarks([...selectedLandmarks, customLandmark]);

    Toast.show({
      type: "success",
      text1: "Landmark added",
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
