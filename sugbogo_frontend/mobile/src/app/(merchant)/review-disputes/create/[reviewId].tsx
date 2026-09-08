import { useLocalSearchParams } from "expo-router";

import CreateReviewDisputeScreen from "@/features/merchant/screens/merchant-mode/CreateReviewDisputeScreen";

/** Resolves the selected review for the merchant dispute form. */
export default function CreateReviewDisputeRoute() {
  const { reviewId } = useLocalSearchParams<{ reviewId: string }>();

  return <CreateReviewDisputeScreen reviewId={Number(reviewId)} />;
}
