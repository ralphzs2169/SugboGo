import { useLocalSearchParams } from "expo-router";
import RecentExploreBusinessScreen from "@/features/explore/screens/RecentExploreBusinessScreen";
/** Opens local-only detail within the Recent Explore access boundary. */
export default function RecentExploreBusinessRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const id = Number(businessId);
  return (
    <RecentExploreBusinessScreen
      businessId={Number.isSafeInteger(id) && id > 0 ? id : 0}
    />
  );
}
