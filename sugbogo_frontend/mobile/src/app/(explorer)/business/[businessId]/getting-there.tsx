import { useLocalSearchParams } from "expo-router";

import GettingThereScreen from "@/features/explore/screens/GettingThereScreen";

/**
 * Provides the route boundary for Explorer jeepney guidance to one business.
 */
export default function GettingThereRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  return <GettingThereScreen businessId={Number(businessId)} />;
}
