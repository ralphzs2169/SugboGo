import { useEffect } from "react";
import { router } from "expo-router";

import { useReviewLandmarksStore } from "@/features/merchant/stores/reviewLandmarksStore";
import ReviewLandmarksScreen from "@/features/merchant/screens/ReviewLandmarksScreen";

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
        if (returnTo === "application-summary") {
          router.replace(
            "/(explorer)/merchant-registration/submission-success",
          );
        } else {
          router.back();
        }
      }}
    />
  );
}
