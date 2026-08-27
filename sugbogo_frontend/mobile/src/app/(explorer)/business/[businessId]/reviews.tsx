import { useLocalSearchParams } from "expo-router";
import ExploreBusinessReviewsScreen from "@/features/explore/screens/ExploreBusinessReviewsScreen";

export default function BusinessReviewsRoute() {
  const { businessId, isOwnBusiness } = useLocalSearchParams<{
    businessId: string;
    isOwnBusiness: string;
  }>();

  return (
    <ExploreBusinessReviewsScreen
      businessId={Number(businessId)}
      isOwnBusiness={isOwnBusiness === "1"}
    />
  );
}
