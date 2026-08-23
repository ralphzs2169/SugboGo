import { useLocalSearchParams } from "expo-router";

import ExploreBusinessProfileScreen from "@/features/explore/screens/ExploreBusinessProfileScreen";

export default function BusinessDetailRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  return <ExploreBusinessProfileScreen businessId={Number(businessId)} />;
}
