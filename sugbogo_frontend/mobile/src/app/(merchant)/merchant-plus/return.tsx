import { useLocalSearchParams } from "expo-router";
import MerchantPlusReturnScreen from "@/features/merchant/screens/merchant-mode/MerchantPlusReturnScreen";
import { parseMerchantPlusReturnOutcome } from "@/features/merchant/utils/merchantPlusReturn";

/** Receives a navigation hint inside the existing authenticated merchant boundary. */
export default function MerchantPlusReturnRoute() {
  const { outcome } = useLocalSearchParams<{ outcome?: string | string[] }>();
  return <MerchantPlusReturnScreen outcome={parseMerchantPlusReturnOutcome(outcome)} />;
}
