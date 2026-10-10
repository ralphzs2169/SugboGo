import ExploreBusinessProfileScreen from "@/features/explore/screens/ExploreBusinessProfileScreen";

import { useLocalSearchParams } from "expo-router";

export default function BusinessDetailRoute() {
  const { businessId, distance, distanceAccuracy, previewAsExplorer } =
    useLocalSearchParams<{
      businessId: string;
      distance?: string;
      distanceAccuracy?: string;
      previewAsExplorer?: string;
    }>();

  return (
    <ExploreBusinessProfileScreen
      businessId={Number(businessId)}
      distance={distance ? Number(distance) : null}
      distanceAccuracy={distanceAccuracy ? Number(distanceAccuracy) : null}
      previewAsExplorer={previewAsExplorer === "1"}
    />
  );
}
