import { useLocalSearchParams } from "expo-router";

import JeepneyRouteMapScreen from "@/features/explore/screens/JeepneyRouteMapScreen";

/** Provides the route boundary for one selected direct journey map. */
export default function JeepneyRouteMapRoute() {
  const {
    businessId,
    routeVariantId,
    boardingTransitPointId,
    alightingTransitPointId,
  } = useLocalSearchParams<{
    businessId: string;
    routeVariantId: string;
    boardingTransitPointId: string;
    alightingTransitPointId: string;
  }>();

  return (
    <JeepneyRouteMapScreen
      businessId={Number(businessId)}
      routeVariantId={Number(routeVariantId)}
      boardingTransitPointId={Number(boardingTransitPointId)}
      alightingTransitPointId={Number(alightingTransitPointId)}
    />
  );
}
