import ExploreBusinessProfileScreen from "@/features/explore/screens/ExploreBusinessProfileScreen";
import { normalizeDiscoverySource } from "@/features/explore/constants/discoverySources";

import { useLocalSearchParams } from "expo-router";

export default function BusinessDetailRoute() {
  const {
    businessId,
    distance,
    distanceAccuracy,
    previewAsExplorer,
    profileSource,
  } = useLocalSearchParams<{
    businessId: string;
    distance?: string;
    distanceAccuracy?: string;
    previewAsExplorer?: string;
    profileSource?: string | string[];
  }>();

  return (
    <ExploreBusinessProfileScreen
      businessId={Number(businessId)}
      distance={distance ? Number(distance) : null}
      distanceAccuracy={distanceAccuracy ? Number(distanceAccuracy) : null}
      previewAsExplorer={previewAsExplorer === "1"}
      profileSource={normalizeDiscoverySource(profileSource)}
    />
  );
}
