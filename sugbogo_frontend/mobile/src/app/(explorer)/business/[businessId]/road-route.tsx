import { useLocalSearchParams } from "expo-router";

import RoadRouteScreen from "@/features/explore/screens/RoadRouteScreen";

/** Provides the Expo Router boundary for one business road route. */
export default function RoadRouteRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  return <RoadRouteScreen businessId={Number(businessId)} />;
}
