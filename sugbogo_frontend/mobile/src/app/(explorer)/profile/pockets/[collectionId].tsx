import { useLocalSearchParams } from "expo-router";

import PocketCollectionScreen from "@/features/pockets/screens/PocketCollectionScreen";

/** Validates the Pocket identity at the Profile navigation boundary. */
export default function PocketCollectionRoute() {
  const { collectionId } = useLocalSearchParams<{
    collectionId?: string | string[];
  }>();
  const parsedId =
    typeof collectionId === "string" && /^\d+$/.test(collectionId)
      ? Number(collectionId)
      : NaN;
  const validId =
    Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;

  return <PocketCollectionScreen collectionId={validId} />;
}
