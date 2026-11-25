import { Redirect, Stack, useLocalSearchParams } from "expo-router";

import { experimentalItinerariesEnabled } from "@/features/explore/constants/experimentalItinerary.constants";
import ExperimentalItineraryScreen from "@/features/explore/screens/ExperimentalItineraryScreen";

/** Guard the experimental route, including direct navigation and deep links. */
export default function ExperimentalItinerariesRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const id = Number(businessId);
  if (!Number.isSafeInteger(id) || id < 1) return <Redirect href="/" />;
  if (!experimentalItinerariesEnabled()) {
    return <Redirect href={{ pathname: "/(explorer)/business/[businessId]/getting-there", params: { businessId: id } }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: "Jeepney itinerary preview" }} />
      <ExperimentalItineraryScreen businessId={id} />
    </>
  );
}
