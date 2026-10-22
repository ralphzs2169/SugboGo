import RecentExploreScreen from "@/features/explore/screens/RecentExploreScreen";
/** Read-only cold-start entry; this route never grants Explorer authentication. */
export default function RecentExploreRoute() {
  return <RecentExploreScreen />;
}
