// src/app/(merchant)/(tabs)/_layout.tsx
import CustomTabBar, { TabBarConfig } from "@/shared/components/CustomTabBar";
import { Tabs } from "expo-router";

const MERCHANT_TAB_CONFIG: TabBarConfig = {
  dashboard: { icon: "grid", label: "Dashboard" },
  analytics: { icon: "analytics", label: "Analytics" },
  reviews: { icon: "chatbubble-ellipses", label: "Reviews" },
  profile: { icon: "person", label: "Profile" },
};

export default function MerchantTabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <CustomTabBar {...props} config={MERCHANT_TAB_CONFIG} />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics" }} />
      <Tabs.Screen name="reviews" options={{ title: "Reviews" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
