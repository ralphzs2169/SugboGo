import { useLocalSearchParams } from "expo-router";
import ReviewsCollectionScreen from "@/features/explore/screens/ReviewsCollectionScreen";

export default function BusinessReviewsRoute() {
  const { businessId, isOwnBusiness } = useLocalSearchParams<{
    businessId: string;
    isOwnBusiness: string;
  }>();

  return (
    <ReviewsCollectionScreen
      businessId={Number(businessId)}
      isOwnBusiness={isOwnBusiness === "1"}
    />
  );
}
