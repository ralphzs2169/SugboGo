import { useLocalSearchParams } from "expo-router";

import GettingThereScreen from "@/features/explore/screens/GettingThereScreen";

/** Route boundary for a business's map and transportation choices. */
export default function GettingThereRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  return <GettingThereScreen businessId={Number(businessId)} />;
}
