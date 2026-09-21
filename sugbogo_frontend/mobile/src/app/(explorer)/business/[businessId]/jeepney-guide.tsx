import { useLocalSearchParams } from "expo-router";

import JeepneyGuideScreen from "@/features/explore/screens/JeepneyGuideScreen";

/** Provides the route boundary for direct jeepney guidance to one business. */
export default function JeepneyGuideRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  return <JeepneyGuideScreen businessId={Number(businessId)} />;
}
