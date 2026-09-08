import { useLocalSearchParams } from "expo-router";

import ReviewDisputeDetailScreen from "@/features/merchant/screens/merchant-mode/ReviewDisputeDetailScreen";

/** Resolves the route parameter for the canonical merchant dispute detail. */
export default function ReviewDisputeDetailRoute() {
  const { disputeId } = useLocalSearchParams<{ disputeId: string }>();

  return <ReviewDisputeDetailScreen disputeId={Number(disputeId)} />;
}
