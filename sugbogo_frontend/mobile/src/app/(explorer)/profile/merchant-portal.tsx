import { useLocalSearchParams } from "expo-router";

import MerchantPortalScreen from "@/features/merchant/screens/MerchantPortalScreen";

export default function MerchantPortalPage() {
  const { continueTo } = useLocalSearchParams<{ continueTo?: string }>();

  return (
    <MerchantPortalScreen
      continueToBusinessProfile={continueTo === "business-profile"}
    />
  );
}
