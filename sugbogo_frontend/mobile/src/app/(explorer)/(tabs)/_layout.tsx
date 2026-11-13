import ExplorerTourHost from "@/features/guided-tour/components/ExplorerTourHost";
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

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

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

/** Mounts the tour alongside the Explorer navigator and its real tab buttons. */
export default function TabLayout() {
  return (
    <ExplorerTourHost>
      <Tabs
        tabBar={renderExplorerTabBar}
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
    </ExplorerTourHost>
  );
}
