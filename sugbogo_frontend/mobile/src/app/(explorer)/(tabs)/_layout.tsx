import { useAuthStore } from "@/features/auth/store/auth.store";
import { useExplorerTour } from "@/features/guided-tour/hooks/useExplorerTour";
import CustomTabBar, { TabBarConfig } from "@/shared/components/CustomTabBar";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

const EXPLORER_TAB_CONFIG: TabBarConfig = {
  explore: { icon: "compass", label: "Explore" },
  map: { icon: "map", label: "Map" },
  community: { icon: "users", label: "Community" },
  profile: { icon: "user", label: "Profile" },
};

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

// The navigator invokes this as a callback outside a component's hook scope.
function renderExplorerTabBar(props: TabBarProps) {
  return <ExplorerTabBar {...props} />;
}

/** Registers the real tab buttons as spotlight targets. */
function ExplorerTabBar(props: TabBarProps) {
  const tour = useExplorerTour();
  return (
    <CustomTabBar
      {...props}
      config={EXPLORER_TAB_CONFIG}
      onTargetRef={tour?.setTarget}
      onTargetLayout={tour?.invalidateLayout}
    />
  );
}

/** Connects the Explorer navigator's real tab buttons to the shared spotlight. */
export default function TabLayout() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Tabs
      tabBar={authenticated ? renderExplorerTabBar : () => null}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Protected guard={authenticated}>
        <Tabs.Screen name="map" options={{ title: "Map" }} />
        <Tabs.Screen name="community" options={{ title: "Community" }} />
        <Tabs.Screen
          name="profile"
          options={{ headerShown: false, title: "Profile", href: "/profile" }}
        />
      </Tabs.Protected>
    </Tabs>
  );
}
