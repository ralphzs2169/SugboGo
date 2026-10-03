import { useLocalSearchParams } from "expo-router";

import LocationChangeDetailScreen from "@/features/merchant/screens/merchant-mode/LocationChangeDetailScreen";

/** Opens one merchant-owned Location request snapshot. */
export default function LocationChangeDetailRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <LocationChangeDetailScreen requestId={Number(requestId)} />;
}
