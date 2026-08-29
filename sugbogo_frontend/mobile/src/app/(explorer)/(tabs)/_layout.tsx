import CustomTabBar, { TabBarConfig } from "@/shared/components/CustomTabBar";
import { Tabs } from "expo-router";

const EXPLORER_TAB_CONFIG: TabBarConfig = {
  explore: { icon: "search", label: "Explore" },
  map: { icon: "map", label: "Map" },
  community: { icon: "people", label: "Community" },
  profile: { icon: "person", label: "Profile" },
};

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <CustomTabBar {...props} config={EXPLORER_TAB_CONFIG} />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="community" options={{ title: "Community" }} />
      <Tabs.Screen
        name="profile"
        options={{ headerShown: false, title: "Profile", href: "/profile" }}
      />
    </Tabs>
  );
}
