import { useAuthStore } from "@/features/auth/store/auth.store";
import ExplorerTourHost from "@/features/guided-tour/components/ExplorerTourHost";
import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
} from "@/features/offline-routes/stores/offlineAccess.store";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import { Redirect, Stack } from "expo-router";

/** Admits the Explore tab from a local grant while protecting the rest of Explorer. */
export default function ExplorerLayout() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const recentExplore = useOfflineAccessStore((state) => state.recentExplore);
  const offlineOwnerId = useOfflineAccessStore((state) => state.ownerId);

  const offlineExplore = recentExplore && isRecentExploreCurrent(recentExplore);

  if (!authenticated && !offlineExplore) {
    return (
      <Redirect href={offlineOwnerId ? "/offline-storage" : "/(auth)/login"} />
    );
  }

  return (
    <ExplorerTourHost>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Protected guard={authenticated}>
          <Stack.Screen
            name="search-filter-results"
            options={{
              ...defaultStackScreenOptions,
              ...slideFromRight,
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="explore-collection/[collectionType]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              animationTypeForReplace: "push",
            }}
          />

          {/* Business profile */}
          <Stack.Screen
            name="business/[businessId]"
            options={{
              ...defaultStackScreenOptions,
              ...slideFromRight,
              headerShown: false,
            }}
          />

          {/* Explorer profile */}
          <Stack.Screen
            name="profile"
            options={{
              ...defaultStackScreenOptions,
              ...slideFromRight,
              title: "Profile",
            }}
          />

          {/* Merchant registration */}
          <Stack.Screen
            name="merchant-registration"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              animationTypeForReplace: "push",
            }}
          />
        </Stack.Protected>
      </Stack>
    </ExplorerTourHost>
  );
}
