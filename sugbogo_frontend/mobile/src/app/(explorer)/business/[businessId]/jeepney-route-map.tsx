import { useLocalSearchParams } from "expo-router";

import JeepneyRouteMapScreen from "@/features/explore/screens/JeepneyRouteMapScreen";

/** Provides the route boundary for one selected direct journey map. */
export default function JeepneyRouteMapRoute() {
  const {
    businessId,
    routeVariantId,
    boardingTransitPointId,
    alightingTransitPointId,
    arrivalLandmarkId,
  } = useLocalSearchParams<{
    businessId: string;
    routeVariantId: string;
    boardingTransitPointId: string;
    alightingTransitPointId: string;
    arrivalLandmarkId?: string;
  }>();

  return (
    <JeepneyRouteMapScreen
      businessId={Number(businessId)}
      routeVariantId={Number(routeVariantId)}
      boardingTransitPointId={Number(boardingTransitPointId)}
      alightingTransitPointId={Number(alightingTransitPointId)}
      arrivalLandmarkId={
        arrivalLandmarkId === undefined ? undefined : Number(arrivalLandmarkId)
      }
    />
  );
}
