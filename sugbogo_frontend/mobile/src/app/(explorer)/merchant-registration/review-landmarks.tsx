import { router } from "expo-router";

import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import ReviewLandmarksScreen from "@/features/merchant/screens/ReviewLandmarksScreen";

export default function ReviewLandmarksPage() {
  const selectedLocation = useMerchantRegistrationStore(
    (state) => state.selectedLocation,
  );

  const selectedLandmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );

  if (!selectedLocation) {
    router.back();
    return null;
  }

  return (
    <ReviewLandmarksScreen
      businessLocation={selectedLocation}
      selectedLandmarks={selectedLandmarks}
      onClose={() => router.back()}
    />
  );
}
