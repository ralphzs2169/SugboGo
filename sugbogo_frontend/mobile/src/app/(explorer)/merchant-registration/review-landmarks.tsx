import { router } from "expo-router";
import { useEffect } from "react";

import ReviewLandmarksScreen from "@/features/merchant/screens/ReviewLandmarksScreen";
import { useReviewLandmarksStore } from "@/features/merchant/stores/reviewLandmarksStore";

export default function ReviewLandmarksPage() {
  const businessLocation = useReviewLandmarksStore(
    (state) => state.businessLocation,
  );

  const selectedLandmarks = useReviewLandmarksStore(
    (state) => state.selectedLandmarks,
  );

  const clearPreview = useReviewLandmarksStore((state) => state.clearPreview);

  const returnTo = useReviewLandmarksStore((state) => state.returnTo);

  useEffect(() => {
    if (!businessLocation) {
      router.back();
    }

    return () => {
      clearPreview();
    };
  }, [businessLocation, clearPreview]);

  if (!businessLocation) {
    return null;
  }

  return (
    <ReviewLandmarksScreen
      businessLocation={businessLocation}
      selectedLandmarks={selectedLandmarks}
      onClose={() => {
        router.back();
      }}
    />
  );
}
