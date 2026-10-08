import { router } from "expo-router";
import { useEffect } from "react";

import ReviewLandmarksScreen from "@/features/merchant/screens/ReviewLandmarksScreen";
import { useLocationChangeReviewStore } from "@/features/merchant/stores/locationChangeReviewStore";

/** Opens the selected request snapshot using the established landmark map. */
export default function LocationChangeReviewLandmarksRoute() {
  const title = useLocationChangeReviewStore((state) => state.title);
  const businessLocation = useLocationChangeReviewStore(
    (state) => state.businessLocation,
  );
  const landmarks = useLocationChangeReviewStore((state) => state.landmarks);
  const clearPreview = useLocationChangeReviewStore(
    (state) => state.clearPreview,
  );

  useEffect(() => {
    if (!businessLocation) {
      router.back();
    }
    return () => clearPreview();
  }, [businessLocation, clearPreview]);

  if (!businessLocation) {
    return null;
  }

  return (
    <ReviewLandmarksScreen
      businessLocation={businessLocation}
      selectedLandmarks={landmarks}
      title={title}
      description="Review the business pin and nearby landmarks for this request."
      onClose={() => router.back()}
    />
  );
}
