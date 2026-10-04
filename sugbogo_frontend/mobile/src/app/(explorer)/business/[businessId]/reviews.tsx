import { useLocalSearchParams } from "expo-router";
import ReviewsCollectionScreen from "@/features/explore/screens/ReviewsCollectionScreen";

export default function BusinessReviewsRoute() {
  const { businessId, isOwnBusiness, previewAsExplorer } =
    useLocalSearchParams<{
      businessId: string;
      isOwnBusiness: string;
      previewAsExplorer?: string;
    }>();

  return (
    <ReviewsCollectionScreen
      businessId={Number(businessId)}
      isOwnBusiness={isOwnBusiness === "1"}
      previewAsExplorer={previewAsExplorer === "1"}
    />
  );
}
