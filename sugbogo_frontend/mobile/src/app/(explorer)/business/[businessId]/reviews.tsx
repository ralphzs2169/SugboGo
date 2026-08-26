import { useLocalSearchParams } from "expo-router";
import ExploreBusinessReviewsScreen from "@/features/explore/screens/ExploreBusinessReviewsScreen";

export default function BusinessReviewsRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  return <ExploreBusinessReviewsScreen businessId={Number(businessId)} />;
}
