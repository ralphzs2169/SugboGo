import { useLocalSearchParams } from "expo-router";

import GettingThereScreen from "@/features/explore/screens/GettingThereScreen";

/** Provides the route boundary for one business's transportation hub. */
export default function GettingThereRoute() {
  const { businessId } = useLocalSearchParams<{
    businessId: string;
  }>();

  return <GettingThereScreen businessId={Number(businessId)} />;
}
