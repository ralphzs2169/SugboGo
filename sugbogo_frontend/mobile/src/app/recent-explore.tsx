import { Redirect } from "expo-router";

/** Keeps links to the former feed entry working through the Explore route guard. */
export default function RecentExploreRoute() {
  return <Redirect href="/(explorer)/(tabs)/explore" />;
}
