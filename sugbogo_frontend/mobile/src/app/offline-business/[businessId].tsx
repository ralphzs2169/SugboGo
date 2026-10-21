import { useLocalSearchParams } from "expo-router";
import OfflineBusinessDetailScreen from "@/features/offline-pockets/screens/OfflineBusinessDetailScreen";

/** Only the business identity travels through navigation; owner identity never does. */
export default function OfflineBusinessRoute() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const id = Number(businessId);
  return (
    <OfflineBusinessDetailScreen
      businessId={Number.isSafeInteger(id) && id > 0 ? id : 0}
    />
  );
}
