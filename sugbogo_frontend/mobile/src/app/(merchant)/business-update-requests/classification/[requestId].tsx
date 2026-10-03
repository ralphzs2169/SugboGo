import { useLocalSearchParams } from "expo-router";

import ClassificationChangeDetailScreen from "@/features/merchant/screens/merchant-mode/ClassificationChangeDetailScreen";
import ErrorState from "@/shared/components/ErrorState";

/** Validates the route ID before opening a classification request. */
export default function ClassificationRequestDetailRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const parsedId = Number(requestId);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return (
      <ErrorState
        title="Request not found"
        description="This request is unavailable."
      />
    );
  }

  return <ClassificationChangeDetailScreen requestId={parsedId} />;
}
