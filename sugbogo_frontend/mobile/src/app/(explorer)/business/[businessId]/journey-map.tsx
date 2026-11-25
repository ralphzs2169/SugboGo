import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { experimentalItinerariesEnabled } from "@/features/explore/constants/experimentalItinerary.constants";
import ItineraryJourneyScreen from "@/features/explore/screens/ItineraryJourneyScreen";
/** Keep the selected itinerary flow behind the existing native feature guard. */
export default function JourneyRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const id = Number(businessId);
  if (!experimentalItinerariesEnabled() || !Number.isSafeInteger(id) || id < 1)
    return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ItineraryJourneyScreen businessId={id} map={true} />
    </>
  );
}
