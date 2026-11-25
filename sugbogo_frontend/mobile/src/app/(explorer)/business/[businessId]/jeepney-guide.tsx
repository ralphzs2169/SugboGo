import { Redirect, useLocalSearchParams } from "expo-router";

import { experimentalItinerariesEnabled } from "@/features/explore/constants/experimentalItinerary.constants";
import JeepneyGuideScreen from "@/features/explore/screens/JeepneyGuideScreen";

/** Open geometric guidance by default on supported development clients. */
export default function JeepneyGuideRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  if (__DEV__ && experimentalItinerariesEnabled()) {
    return (
      <Redirect
        href={{
          pathname: "/(explorer)/business/[businessId]/experimental-itineraries",
          params: { businessId },
        }}
      />
    );
  }

  return <JeepneyGuideScreen businessId={Number(businessId)} />;
}
