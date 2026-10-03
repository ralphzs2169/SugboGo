import { useLocalSearchParams } from "expo-router";

import BusinessNameChangeDetailScreen from "@/features/merchant/screens/merchant-mode/BusinessNameChangeDetailScreen";
import ErrorState from "@/shared/components/ErrorState";

/** Resolves the request ID before opening the merchant detail screen. */
export default function BusinessUpdateRequestDetailRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const id = Number(requestId);

  if (!Number.isInteger(id) || id < 1) {
    return (
      <ErrorState
        title="Invalid request"
        description="This request link is unavailable."
      />
    );
  }

  return <BusinessNameChangeDetailScreen requestId={id} />;
}
