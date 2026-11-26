import { Redirect, useLocalSearchParams } from "expo-router";

import { experimentalItinerariesEnabled } from "@/features/explore/constants/experimentalItinerary.constants";
import JeepneyGuideScreen from "@/features/explore/screens/JeepneyGuideScreen";

/** Open geometry-first guidance when available and otherwise show the legacy guide. */
export default function JeepneyGuideRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  if (experimentalItinerariesEnabled()) {
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
