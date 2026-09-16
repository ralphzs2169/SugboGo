import { useLocalSearchParams } from "expo-router";

import JeepneyStartingPointScreen from "@/features/explore/screens/JeepneyStartingPointScreen";

/** Provides the route boundary for the Jeepney Guide origin picker. */
export default function JeepneyStartingPointRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  return <JeepneyStartingPointScreen businessId={Number(businessId)} />;
}
