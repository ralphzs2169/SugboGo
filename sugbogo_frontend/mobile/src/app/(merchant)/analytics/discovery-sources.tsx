import { useLocalSearchParams } from "expo-router";
import MerchantDiscoverySourcesScreen from "@/features/merchant/screens/merchant-mode/MerchantDiscoverySourcesScreen";

/** Standard report route, independent of PlusDetailKind and PlusAccessGate. */
export default function DiscoverySourcesRoute() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  return (
    <MerchantDiscoverySourcesScreen
      initialPeriod={period === "7" || period === "90" ? period : "30"}
    />
  );
}
